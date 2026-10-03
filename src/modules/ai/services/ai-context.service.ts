import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { FindOptionsSelect, FindOptionsWhere } from 'typeorm';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { MetricaKpi } from '../../performance/entities/metrica-kpi.entity';
import type {
  ContextoMetrica,
  EmpleadoAnalitico,
  PeriodoAnalitico,
  UsuarioAnalitico,
} from '../interfaces/ai-context.interface';
import { numeroAnalitico } from '../utils/numero-analitico';

@Injectable()
export class AiContextService {
  private readonly seleccionEmpleado: FindOptionsSelect<Empleado> = {
    idEmpleado: true,
    puesto: { idPuesto: true, idDepartamento: true },
  };

  constructor(
    @InjectRepository(Empleado)
    private readonly empleados: Repository<Empleado>,
    @InjectRepository(MetricaKpi)
    private readonly metricas: Repository<MetricaKpi>,
  ) {}

  obtenerPeriodo(anio: number, mes: number): PeriodoAnalitico {
    if (
      !Number.isInteger(anio) ||
      anio < 2000 ||
      anio > 9999 ||
      !Number.isInteger(mes) ||
      mes < 1 ||
      mes > 12
    ) {
      throw new BadRequestException('Periodo invalido');
    }
    const prefijo = `${anio}-${String(mes).padStart(2, '0')}`;
    return {
      anio,
      mes,
      fechaInicial: `${prefijo}-01`,
      fechaFinal: `${prefijo}-${new Date(Date.UTC(anio, mes, 0)).getUTCDate()}`,
    };
  }

  obtenerPeriodos(
    anio: number,
    mes: number,
    cantidadMeses: number,
  ): PeriodoAnalitico[] {
    this.obtenerPeriodo(anio, mes);
    if (
      !Number.isInteger(cantidadMeses) ||
      cantidadMeses < 1 ||
      cantidadMeses > 12
    ) {
      throw new BadRequestException('cantidadMeses debe estar entre 1 y 12');
    }
    return Array.from({ length: cantidadMeses }, (_, indice) => {
      const fecha = new Date(Date.UTC(anio, mes - cantidadMeses + indice, 1));
      return this.obtenerPeriodo(
        fecha.getUTCFullYear(),
        fecha.getUTCMonth() + 1,
      );
    });
  }

  async autorizarEquipo(
    usuario: UsuarioAnalitico,
    idEncargado: number,
  ): Promise<EmpleadoAnalitico[]> {
    await this.validarUsuario(usuario);
    this.validarId(idEncargado);
    if (
      usuario.nivelJerarquico === 1 ||
      (usuario.nivelJerarquico === 2 && usuario.idEmpleado !== idEncargado)
    ) {
      throw new ForbiddenException('No puedes consultar este equipo');
    }
    const encargado = await this.empleados.findOne({
      select: { idEmpleado: true },
      where: { idEmpleado: idEncargado, isActive: true },
    });
    if (!encargado)
      throw new NotFoundException('El encargado no existe o esta inactivo');
    const empleados = await this.empleados.find({
      select: this.seleccionEmpleado,
      relations: { puesto: true },
      where: { jefeDirecto: { idEmpleado: idEncargado }, isActive: true },
      order: { idEmpleado: 'ASC' },
    });
    return empleados.map((empleado) => this.contextoEmpleado(empleado));
  }

  async autorizarEmpleado(
    usuario: UsuarioAnalitico,
    idEmpleado: number,
  ): Promise<EmpleadoAnalitico> {
    await this.validarUsuario(usuario);
    this.validarId(idEmpleado);
    if (usuario.nivelJerarquico === 1 && usuario.idEmpleado !== idEmpleado) {
      throw new ForbiddenException('Solo puedes consultar tus propios datos');
    }
    const where: FindOptionsWhere<Empleado> = { idEmpleado, isActive: true };
    if (usuario.nivelJerarquico === 2) {
      where.jefeDirecto = { idEmpleado: usuario.idEmpleado! };
    }
    const empleado = await this.empleados.findOne({
      select: this.seleccionEmpleado,
      relations: { puesto: true },
      where,
    });
    if (!empleado) {
      if (usuario.nivelJerarquico === 2) {
        throw new ForbiddenException(
          'El empleado no pertenece a tu equipo activo',
        );
      }
      throw new NotFoundException('El empleado no existe o esta inactivo');
    }
    return this.contextoEmpleado(empleado);
  }

  async obtenerCatalogo(
    empleados: EmpleadoAnalitico[],
    idsRegistrados: number[],
  ): Promise<ContextoMetrica[]> {
    const departamentos = [
      ...new Set(
        empleados.flatMap((e) =>
          e.idDepartamento === null ? [] : [e.idDepartamento],
        ),
      ),
    ];
    const where: FindOptionsWhere<MetricaKpi>[] = [];
    if (departamentos.length)
      where.push({ idDepartamento: In(departamentos), isActive: true });
    if (idsRegistrados.length)
      where.push({ idMetrica: In([...new Set(idsRegistrados)]) });
    if (!where.length) return [];
    const metricas = await this.metricas.find({
      select: {
        idMetrica: true,
        idDepartamento: true,
        codigoKpi: true,
        nombreKpi: true,
        unidadMedida: true,
        metaObjetivo: true,
        tipoCalculo: true,
        isActive: true,
      },
      where,
      order: { idMetrica: 'ASC' },
    });
    return metricas.map((metrica) => ({
      idMetrica: metrica.idMetrica,
      idDepartamento: metrica.idDepartamento,
      codigoKpi: metrica.codigoKpi,
      nombreKpi: metrica.nombreKpi,
      unidadMedida: metrica.unidadMedida,
      tipoCalculo: metrica.tipoCalculo,
      metaObjetivo:
        metrica.metaObjetivo == null
          ? null
          : numeroAnalitico(metrica.metaObjetivo),
      activa: Boolean(metrica.isActive),
    }));
  }

  private contextoEmpleado(empleado: Empleado): EmpleadoAnalitico {
    return {
      idEmpleado: empleado.idEmpleado,
      idDepartamento: empleado.puesto?.idDepartamento ?? null,
    };
  }

  private validarId(id: number) {
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
      throw new BadRequestException('Identificador invalido');
    }
  }

  private async validarUsuario(usuario: UsuarioAnalitico) {
    if (
      !usuario ||
      !Number.isSafeInteger(usuario.idUsuario) ||
      usuario.idUsuario < 1 ||
      ![1, 2, 3, 4].includes(usuario.nivelJerarquico)
    ) {
      throw new ForbiddenException('Contexto de usuario invalido');
    }
    if (usuario.nivelJerarquico <= 2) {
      if (
        !Number.isSafeInteger(usuario.idEmpleado) ||
        !usuario.idEmpleado ||
        usuario.idEmpleado < 1
      ) {
        throw new ForbiddenException(
          'Tu usuario no tiene un empleado asociado',
        );
      }
      const actor = await this.empleados.findOne({
        select: { idEmpleado: true },
        where: { idEmpleado: usuario.idEmpleado, isActive: true },
      });
      if (!actor)
        throw new ForbiddenException('Tu empleado no existe o esta inactivo');
    }
  }
}
