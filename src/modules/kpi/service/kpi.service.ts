import { CODIGO_TIEMPO, tiempoProvisionalVigente, resultadoTiempoProvisional } from '../../performance/services/tiempo-provisional';
import { aporteKpi, pesoKpi } from '../../performance/services/ponderacion-kpi';
import { cumplimientoReal } from '../../performance/services/cumplimiento-kpi';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { EvaluacionDesempeno } from '../../performance/entities/evaluacion-desempeno.entity';
import { MetricaKpiDiaria } from '../../performance/entities/metrica-kpi-diaria.entity';
import { MetricaKpi } from '../../performance/entities/metrica-kpi.entity';
import { ResultadoKpi } from '../../performance/entities/resultado-kpi.entity';
import { DetalleResultadoKpi } from '../../performance/entities/detalle-resultado-kpi.entity';
import { DashboardKpiResponseDto, SerieDiariaKpiDto } from '../dto/dashboard-kpi-response.dto';

function pesoHistoricoVentas(observacion: string, configurado: string): number {
  try { const peso = JSON.parse(observacion).pesoPorcentaje; if (typeof peso === 'number' && Number.isFinite(peso)) return peso; } catch {}
  return Number(configurado);
}

const numeroNullable = (valor: string | null): number | null =>
  valor == null ? null : Number(valor);

@Injectable()
export class KpiService {
  constructor(
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
  ) {}

  async obtenerDashboard(
    idEmpleado: number | null | undefined,
    anio: number,
    mes: number,
  ): Promise<DashboardKpiResponseDto> {
    // Validar antes de consultar: un ID undefined puede eliminar el filtro en TypeORM.
    if (!Number.isInteger(idEmpleado) || !idEmpleado || idEmpleado < 1) {
      throw new ForbiddenException('Tu usuario no tiene un empleado asociado.');
    }
    const empleado = await this.empleadoRepository.findOne({
      select: { idEmpleado: true, primerNombre: true, segundoNombre: true, primerApellido: true, segundoApellido: true,
        puesto: { idDepartamento: true, departamento: { nombreDepartamento: true } } },
      relations: { puesto: { departamento: true } },
      where: { idEmpleado, isActive: true },
    });
    if (!empleado) {
      throw new ForbiddenException('el empleado no existe o está inactivo.');
    }

    const fechaInicial = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const fechaFinal = `${anio}-${String(mes).padStart(2, '0')}-${new Date(Date.UTC(anio, mes, 0)).getUTCDate()}`;
    const manager = this.empleadoRepository.manager;
    const [evaluaciones, diarias] = await Promise.all([
      manager.getRepository(EvaluacionDesempeno).find({
        where: { idEmpleado, periodoAnio: anio, periodoMes: mes, isActive: true },
        order: { idDepartamento: 'ASC', idEvaluacionDesempeno: 'ASC' },
      }),
      manager.getRepository(MetricaKpiDiaria).find({
        where: { idEmpleado, fecha: Between(fechaInicial, fechaFinal) },
        order: { fecha: 'ASC', idMetrica: 'ASC' },
      }),
    ]);
    const resultados = evaluaciones.length
      ? await manager.getRepository(ResultadoKpi).find({
          where: {
            idEvaluacionDesempeno: In(evaluaciones.map(e => e.idEvaluacionDesempeno)),
            isActive: true,
          },
          order: { idMetrica: 'ASC' },
        })
      : [];
    const idsMetricas = [...new Set([
      ...resultados.map(r => r.idMetrica),
      ...diarias.flatMap(d => d.idMetrica == null ? [] : [d.idMetrica]),
    ])];
    const [metricas, detalles] = await Promise.all([
      idsMetricas.length
        ? manager.getRepository(MetricaKpi).find({ where: { idMetrica: In(idsMetricas) } })
        : Promise.resolve([]),
      resultados.length
        ? manager.getRepository(DetalleResultadoKpi).find({
            where: { idResultado: In(resultados.map(r => r.idResultado)) },
            order: { idDetalle: 'ASC' },
          })
        : Promise.resolve([]),
    ]);
    const porMetrica = new Map(metricas.map(m => [m.idMetrica, m]));
    const series = new Map<number, SerieDiariaKpiDto>();
    const fechas = new Set<string>();
    let ultimaCargaDiaria: Date | null = null;
    for (const diaria of diarias) {
      if (diaria.idMetrica == null || !diaria.fecha) continue;
      const metrica = porMetrica.get(diaria.idMetrica);
      if (tiempoProvisionalVigente(anio, mes) && metrica?.codigoKpi === CODIGO_TIEMPO) continue;
      let serie = series.get(diaria.idMetrica);
      if (!serie) {
        serie = {
          idMetrica: diaria.idMetrica, codigo: metrica?.codigoKpi ?? null,
          nombre: metrica?.nombreKpi ?? null, unidadMedida: metrica?.unidadMedida ?? null,
          puntos: [],
        };
        series.set(diaria.idMetrica, serie);
      }
      serie.puntos.push({ fecha: diaria.fecha, valor: Number(diaria.valor) });
      fechas.add(diaria.fecha);
      const actualizada = diaria.updatedAt ?? diaria.createdAt;
      if (actualizada && (!ultimaCargaDiaria || actualizada > ultimaCargaDiaria)) {
        ultimaCargaDiaria = actualizada;
      }
    }
    return {
      idEmpleado,
      empleado: {
        nombre: [empleado.primerNombre, empleado.segundoNombre, empleado.primerApellido, empleado.segundoApellido].filter(Boolean).join(' '),
        departamento: empleado.puesto?.departamento?.nombreDepartamento ?? null,
      },
      periodo: { anio, mes, fechaInicial, fechaFinal },
      tieneDatos: evaluaciones.length > 0 || diarias.length > 0,
      ultimaCargaDiaria,
      diasConDatos: fechas.size,
      seriesDiarias: [...series.values()],
      evaluaciones: evaluaciones.map(evaluacion => {
        const propios = resultados.filter(r => r.idEvaluacionDesempeno === evaluacion.idEvaluacionDesempeno);
        const provisional = tiempoProvisionalVigente(anio, mes) && propios.some(r => porMetrica.get(r.idMetrica)?.codigoKpi?.startsWith('BOD_'));
        const visibles = propios.filter(r => !provisional || porMetrica.get(r.idMetrica)?.codigoKpi !== CODIGO_TIEMPO);
        const aporte = (r: ResultadoKpi) => {
          const m = porMetrica.get(r.idMetrica);
          if (m?.codigoKpi.startsWith('VEN_')) return Number(r.puntosObtenidos);
          return aporteKpi(r.valorObtenido, r.metaAplicada, m?.codigoKpi, m?.pesoPorcentaje);
        };
        const porcentajeBase = Math.min(100, visibles.reduce((total, r) => total + aporte(r), provisional ? 25 : 0));
        return ({
        idEvaluacion: evaluacion.idEvaluacionDesempeno,
        idDepartamento: evaluacion.idDepartamento,
        estado: evaluacion.estado,
        tiempoProvisional: provisional,
        puntajeBase: porcentajeBase,
        penalizacionTotal: Number(evaluacion.penalizacionTotal),
        notaFinal: Math.max(0, porcentajeBase - Number(evaluacion.penalizacionTotal)),
        metaGlobal: 100,
        calculadaEn: evaluacion.updatedAt,
        resultados: [...visibles.map(r => {
            const metrica = porMetrica.get(r.idMetrica);
            return {
              idResultado: r.idResultado, idMetrica: r.idMetrica,
              codigo: metrica?.codigoKpi ?? null, nombre: metrica?.nombreKpi ?? null,
              unidadMedida: metrica?.unidadMedida ?? null,
              valorObtenido: Number(r.valorObtenido),
              metaAplicada: numeroNullable(r.metaAplicada),
              porcentajeCumplimiento: metrica?.codigoKpi.startsWith('VEN_') ? numeroNullable(r.porcentajeCumplimiento) : cumplimientoReal(r.valorObtenido, r.metaAplicada, metrica?.codigoKpi),
              pesoPorcentaje: metrica?.codigoKpi.startsWith('VEN_') && r.observacion?.startsWith('{') ? pesoHistoricoVentas(r.observacion, metrica.pesoPorcentaje) : pesoKpi(metrica?.codigoKpi, metrica?.pesoPorcentaje),
              aportePorcentaje: aporte(r),
              puntosObtenidos: aporte(r),
              observacion: r.observacion === 'No existe rango configurado para el valor obtenido.' ? null : r.observacion,
              detalles: detalles.filter(d => d.idResultado === r.idResultado)
                .map(d => ({ origen: d.origen, valor: Number(d.valor), descripcion: d.descripcion })),
            };
          }), ...(provisional ? [resultadoTiempoProvisional()] : [])],
      }); }),
    };
  }
  async obtenerDashboardEquipo(
    idEmpleadoEncargado: number | null | undefined,
    nivel: number | undefined,
    anio: number,
    mes: number,
  ) {
    if (nivel !== 2 && nivel !== 3 && nivel !== 4) {
      throw new ForbiddenException('No tienes permisos para consultar KPI de equipo.');
    }
    const accesoGlobal = nivel === 3 || nivel === 4;
    if (!accesoGlobal && (!Number.isSafeInteger(idEmpleadoEncargado) || !idEmpleadoEncargado || idEmpleadoEncargado < 1)) {
      throw new ForbiddenException('Tu usuario no tiene un empleado asociado.');
    }
    const empleados = await this.empleadoRepository.find({
      where: accesoGlobal
        ? { isActive: true }
        : { isActive: true, jefeDirecto: { idEmpleado: idEmpleadoEncargado! } },
      relations: { puesto: { departamento: true } },
      order: { primerApellido: 'ASC', primerNombre: 'ASC', idEmpleado: 'ASC' },
    });
    const dashboards = [] as {
      empleado: { idEmpleado: number; nombre: string; idDepartamento: number | null; departamento: string | null };
      dashboard: DashboardKpiResponseDto;
    }[];
    // Limitar las consultas simultaneas cuando se consultan todos los departamentos.
    for (let inicio = 0; inicio < empleados.length; inicio += 5) {
      dashboards.push(...await Promise.all(empleados.slice(inicio, inicio + 5).map(async empleado => ({
        empleado: {
          idEmpleado: empleado.idEmpleado,
          nombre: [empleado.primerNombre, empleado.segundoNombre, empleado.primerApellido, empleado.segundoApellido].filter(Boolean).join(' '),
          idDepartamento: empleado.puesto?.idDepartamento ?? null,
          departamento: empleado.puesto?.departamento?.nombreDepartamento ?? null,
        },
        dashboard: await this.obtenerDashboard(empleado.idEmpleado, anio, mes),
      }))));
    }
    return {
      idEncargado: idEmpleadoEncargado ?? null,
      alcance: accesoGlobal ? 'TODOS_DEPARTAMENTOS' as const : 'EQUIPO' as const,
      periodo: { anio, mes },
      totalSubordinados: empleados.length,
      empleados: dashboards,
    };
  }
}
