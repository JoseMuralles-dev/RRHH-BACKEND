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
      select: { idEmpleado: true },
      where: { idEmpleado, isActive: true },
    });
    if (!empleado) {
      throw new ForbiddenException('Tu empleado no existe o está inactivo.');
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
      periodo: { anio, mes, fechaInicial, fechaFinal },
      tieneDatos: evaluaciones.length > 0 || diarias.length > 0,
      ultimaCargaDiaria,
      diasConDatos: fechas.size,
      seriesDiarias: [...series.values()],
      evaluaciones: evaluaciones.map(evaluacion => ({
        idEvaluacion: evaluacion.idEvaluacionDesempeno,
        idDepartamento: evaluacion.idDepartamento,
        estado: evaluacion.estado,
        puntajeBase: Number(evaluacion.puntajeBase),
        penalizacionTotal: Number(evaluacion.penalizacionTotal),
        notaFinal: Number(evaluacion.notaFinal),
        metaGlobal: numeroNullable(evaluacion.metaGlobal),
        calculadaEn: evaluacion.updatedAt,
        resultados: resultados
          .filter(r => r.idEvaluacionDesempeno === evaluacion.idEvaluacionDesempeno)
          .map(r => {
            const metrica = porMetrica.get(r.idMetrica);
            return {
              idResultado: r.idResultado, idMetrica: r.idMetrica,
              codigo: metrica?.codigoKpi ?? null, nombre: metrica?.nombreKpi ?? null,
              unidadMedida: metrica?.unidadMedida ?? null,
              valorObtenido: Number(r.valorObtenido),
              metaAplicada: numeroNullable(r.metaAplicada),
              porcentajeCumplimiento: numeroNullable(r.porcentajeCumplimiento),
              puntosObtenidos: Number(r.puntosObtenidos),
              observacion: r.observacion,
              detalles: detalles.filter(d => d.idResultado === r.idResultado)
                .map(d => ({ origen: d.origen, valor: Number(d.valor), descripcion: d.descripcion })),
            };
          }),
      })),
    };
  }
  async obtenerDashboardEquipo(
  idEmpleadoEncargado: number | null | undefined,
  nivel: number | undefined,
  anio: number,
  mes: number,
) {

  if (
    !Number.isInteger(idEmpleadoEncargado) ||
    !idEmpleadoEncargado
  ) {
    throw new ForbiddenException(
      'Tu usuario no tiene un empleado asociado.',
    );
  }

  if (nivel !== 2 && nivel !== 3 && nivel !== 4) {
    throw new ForbiddenException(
      'No tienes permisos para consultar KPI de equipo.',
    );
  }

  // Buscar subordinados del encargado
const subordinados =
  await this.empleadoRepository.find({
    where: {
      jefeDirecto: {
        idEmpleado: idEmpleadoEncargado,
      },
      isActive: true,
    },
  });

  const dashboards = await Promise.all(
    subordinados.map(async empleado => {

      const dashboard =
        await this.obtenerDashboard(
          empleado.idEmpleado,
          anio,
          mes,
        );

      return {
        empleado: {
          idEmpleado:
            empleado.idEmpleado,

          nombre:
            `${empleado.primerNombre} ${empleado.primerApellido}`,
        },

        dashboard,
      };
    }),
  );

  return {
    idEncargado:
      idEmpleadoEncargado,

    periodo: {
      anio,
      mes,
    },

    totalSubordinados:
      subordinados.length,

    empleados:
      dashboards,
  };
}
}
