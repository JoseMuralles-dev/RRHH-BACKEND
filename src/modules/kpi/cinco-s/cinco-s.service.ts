import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { Departamento } from '../../organization/departamentos/entities/departamento.entity';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { EvaluacionDesempeno } from '../../performance/entities/evaluacion-desempeno.entity';
import { InspeccionCincoS } from './inspeccion-cinco-s.entity';
import { CATEGORIAS_CINCO_S, ESCALA_CINCO_S } from './catalogo-cinco-s';
import { GuardarCincoSDto } from './cinco-s.dto';
import { calcularInspeccion, resumenCincoS, INSPECCIONES_REQUERIDAS } from './cinco-s.reglas';
import { aplicarCincoS, asegurarMetricaCincoS } from './cinco-s.integracion';
import { EvaluacionKpiService } from '../../performance/services/evaluacion-kpi.service';
import { MetricaKpiDiaria } from '../../performance/entities/metrica-kpi-diaria.entity';
import { ResultadoKpi } from '../../performance/entities/resultado-kpi.entity';
import { RangoKpi } from '../../performance/entities/rango-kpi.entity';

export interface UsuarioCincoS { idUsuario: number; idEmpleado?: number; nivelJerarquico?: number; correo?: string }

@Injectable()
export class CincoSService {
  constructor(private readonly dataSource: DataSource) {}

  async departamentos(usuario: UsuarioCincoS, manager = this.dataSource.manager) {
    if (!Number.isInteger(usuario.idUsuario) || usuario.idUsuario < 1 ||
        ![2, 3, 4].includes(usuario.nivelJerarquico ?? 0)) {
      throw new ForbiddenException('No tiene permisos para evaluar departamentos.');
    }
    const repo = manager.getRepository(Departamento);
    if (usuario.nivelJerarquico! >= 3) {
      return repo.find({ where: { isActive: true }, order: { nombreDepartamento: 'ASC' } });
    }
    if (!Number.isInteger(usuario.idEmpleado) || !usuario.idEmpleado || usuario.idEmpleado < 1) {
      throw new ForbiddenException('Su usuario no tiene empleado asociado.');
    }
    const empleados = await manager.getRepository(Empleado).find({
      where: { idJefeDirecto: usuario.idEmpleado, isActive: true }, relations: { puesto: true },
    });
    const ids = [...new Set(empleados.map(e => e.puesto?.idDepartamento).filter((id): id is number => !!id))];
    return ids.length ? repo.find({ where: { idDepartamento: In(ids), isActive: true }, order: { nombreDepartamento: 'ASC' } }) : [];
  }

  async catalogo(usuario: UsuarioCincoS) {
    return { categorias: CATEGORIAS_CINCO_S, escala: ESCALA_CINCO_S, departamentos: await this.departamentos(usuario) };
  }

  private async autorizar(id: number, usuario: UsuarioCincoS, manager = this.dataSource.manager) {
    if (!(await this.departamentos(usuario, manager)).some(d => d.idDepartamento === id)) {
      throw new ForbiddenException('No tiene acceso a este departamento.');
    }
  }

  async consultar(idDepartamento: number, anio: number, mes: number, usuario: UsuarioCincoS) {
    await this.autorizar(idDepartamento, usuario);
    return this.resumen(this.dataSource.manager, idDepartamento, anio, mes);
  }

  private async resumen(manager: EntityManager, idDepartamento: number, anio: number, mes: number) {
    const inspecciones = await manager.getRepository(InspeccionCincoS).find({
      where: { idDepartamento, anio, mes }, order: { numero: 'ASC' },
    });
    return { idDepartamento, anio, mes, inspecciones, ...resumenCincoS(inspecciones) };
  }

  async guardar(dto: GuardarCincoSDto, usuario: UsuarioCincoS) {
    const { total } = calcularInspeccion(dto.puntos);
    const fecha = new Date(`${dto.fecha}T00:00:00Z`);
    if (!Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== dto.fecha ||
        !dto.sucursal.trim() || !dto.encargado.trim()) {
      throw new BadRequestException('Revise la fecha, sucursal y encargado.');
    }
    const anio = fecha.getUTCFullYear(), mes = fecha.getUTCMonth() + 1;
    if (anio < 2000 || anio > 2100) throw new BadRequestException('El año debe estar entre 2000 y 2100.');
    return this.dataSource.transaction('READ COMMITTED', async manager => {
      await this.autorizar(dto.idDepartamento, usuario, manager);
      const departamento = await manager.getRepository(Departamento).findOne({
        where: { idDepartamento: dto.idDepartamento, isActive: true }, lock: { mode: 'pessimistic_write' },
      });
      if (!departamento) throw new NotFoundException('El departamento no existe o está inactivo.');
      const repo = manager.getRepository(InspeccionCincoS);
      const existentes = await repo.find({ where: { idDepartamento: dto.idDepartamento, anio, mes } });
      if (existentes.length >= INSPECCIONES_REQUERIDAS || existentes.some(i => i.numero === dto.numero)) {
        throw new ConflictException('Ya existe esa inspección. Solo se permiten cuatro inspecciones por departamento y mes.');
      }
      await repo.save(repo.create({
        ...dto, sucursal: dto.sucursal.trim(), encargado: dto.encargado.trim(),
        observaciones: dto.observaciones?.trim() || null,
        anio, mes, total, idUsuarioInspector: usuario.idUsuario,
        inspector: usuario.correo || `Usuario #${usuario.idUsuario}`, versionFormato: 1,
      }));
      const actualizacion = await this.actualizarEvaluaciones(manager, dto.idDepartamento, anio, mes);
      return { ...(await this.resumen(manager, dto.idDepartamento, anio, mes)), ...actualizacion };
    });
  }
  async recalcular(
  idDepartamento: number,
  anio: number,
  mes: number,
  usuario: UsuarioCincoS,
) {
  return this.dataSource.transaction(
    'READ COMMITTED',
    async manager => {

      await this.autorizar(
        idDepartamento,
        usuario,
        manager,
      );

      const departamento = await manager.getRepository(Departamento).findOne({
        where: { idDepartamento, isActive: true }, lock: { mode: 'pessimistic_write' },
      });
      if (!departamento) throw new NotFoundException('El departamento no existe o está inactivo.');

      const actualizacion = await this.actualizarEvaluaciones(manager, idDepartamento, anio, mes);
      return {
        idDepartamento, anio, mes, ...actualizacion,
        resumen: await this.resumen(manager, idDepartamento, anio, mes),
      };
    },
  );
}

  private async actualizarEvaluaciones(manager: EntityManager, idDepartamento: number, anio: number, mes: number) {

      const metrica =
        await asegurarMetricaCincoS(
          manager,
          idDepartamento,
        );

      const evaluaciones =
        await manager
          .getRepository(EvaluacionDesempeno)
          .find({
            where: {
              idDepartamento,
              periodoAnio: anio,
              periodoMes: mes,
              isActive: true,
            },
          });

      for (const evaluacion of evaluaciones) {
        await aplicarCincoS(
          manager,
          evaluacion,
          metrica,
        );
      }
      let evaluacionesCreadas = 0;
      const empleadosSinDatos: number[] = [];
      const resumen = await this.resumen(manager, idDepartamento, anio, mes);
      // Con las inspecciones requeridas también generar las evaluaciones que aún no existen.
      // No inventar una nota operativa para empleados sin métricas del período.
      if (resumen.completo) {
        const empleados = await manager.getRepository(Empleado).find({
          where: { isActive: true, puesto: { idDepartamento } },
          select: { idEmpleado: true }, order: { idEmpleado: 'ASC' },
        });
        const existentes = new Set(evaluaciones.map(e => e.idEmpleado));
        const calculador = new EvaluacionKpiService(
          manager.getRepository(MetricaKpiDiaria), manager.getRepository(EvaluacionDesempeno),
          manager.getRepository(ResultadoKpi), manager.getRepository(RangoKpi),
        );
        for (const empleado of empleados) {
          if (existentes.has(empleado.idEmpleado)) continue;
          try {
            await calculador.calcularEvaluacionMensual(empleado.idEmpleado, idDepartamento, anio, mes);
            evaluacionesCreadas++;
          } catch (error) {
            if (!(error instanceof NotFoundException)) throw error;
            empleadosSinDatos.push(empleado.idEmpleado);
          }
        }
      }
      return { evaluacionesActualizadas: evaluaciones.length, evaluacionesCreadas, empleadosSinDatos };
  }
}
