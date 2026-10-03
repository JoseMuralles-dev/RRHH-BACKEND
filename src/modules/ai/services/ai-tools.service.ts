import { Injectable, NotFoundException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';

import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { MetricaKpi } from '../../performance/entities/metrica-kpi.entity';
import { MetricaKpiDiaria } from '../../performance/entities/metrica-kpi-diaria.entity';
import type { DesgloseOrigen } from '../../performance/interfaces/desglose-origen.interface';
import { AiContextService } from './ai-context.service';
import { numeroAnalitico } from '../utils/numero-analitico';
import type {
  AgregadoMensual,
  ContextoMetrica,
  EmpleadoAnalitico,
  PeriodoAnalitico,
  UsuarioAnalitico,
} from '../interfaces/ai-context.interface';
import type {
  ConsultarEmpleadoDto,
  ConsultarEquipoDto,
  ConsultarHistoricoEmpleadoDto,
  ConsultarHistoricoEquipoDto,
  ConsultarSerieMetricaDto,
} from '../dto/consultar-analitica.dto';

export interface MetricaEquipo {
  idMetrica: number;
  codigo: string | null;
  nombre: string | null;
  unidadMedida: string | null;
  metaObjetivo: number | null;
  pesoPorcentaje: number | null;
  serieDiaria: Array<{
    fecha: string;
    valor: number;
    desgloseOrigen: MetricaKpiDiaria['desgloseOrigen'];
  }>;
}

@Injectable()
export class AiToolsService {
  constructor(
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,

    @InjectRepository(MetricaKpiDiaria)
    private readonly metricaDiariaRepository: Repository<MetricaKpiDiaria>,

    @InjectRepository(MetricaKpi)
    private readonly metricaKpiRepository: Repository<MetricaKpi>,

    private readonly contexto: AiContextService,
  ) {}

  async obtenerResumenEquipo(
    dto: ConsultarEquipoDto,
    usuario: UsuarioAnalitico,
  ) {
    const periodo = this.contexto.obtenerPeriodo(dto.anio, dto.mes);
    const empleados = await this.contexto.autorizarEquipo(
      usuario,
      dto.idEncargado,
    );
    const resumen = await this.resumirPeriodos(empleados, [periodo]);
    return {
      idEncargado: dto.idEncargado,
      periodo,
      totalEmpleados: empleados.length,
      criterios: this.criterios(),
      empleados: resumen.map((e) => ({
        idEmpleado: e.idEmpleado,
        tieneDatos: e.periodos[0].tieneDatos,
        metricas: e.periodos[0].metricas,
      })),
    };
  }

  async obtenerMetricasEmpleado(
    dto: ConsultarEmpleadoDto,
    usuario: UsuarioAnalitico,
  ) {
    const periodo = this.contexto.obtenerPeriodo(dto.anio, dto.mes);
    const empleado = await this.contexto.autorizarEmpleado(
      usuario,
      dto.idEmpleado,
    );
    return this.detallarEmpleado(empleado, periodo);
  }

  async obtenerSerieMetricaEmpleado(
    dto: ConsultarSerieMetricaDto,
    usuario: UsuarioAnalitico,
  ) {
    const periodo = this.contexto.obtenerPeriodo(dto.anio, dto.mes);
    const empleado = await this.contexto.autorizarEmpleado(
      usuario,
      dto.idEmpleado,
    );
    const metrica = await this.metricaKpiRepository.findOne({
      select: { idMetrica: true },
      where: { codigoKpi: dto.codigoKpi },
    });
    if (!metrica) throw new NotFoundException('KPI no encontrado');
    const detalle = await this.detallarEmpleado(
      empleado,
      periodo,
      metrica.idMetrica,
    );
    if (!detalle.metricas.length)
      throw new NotFoundException(
        'KPI sin configuracion aplicable ni registros para este empleado',
      );
    return detalle;
  }

  async obtenerHistoricoEquipo(
    dto: ConsultarHistoricoEquipoDto,
    usuario: UsuarioAnalitico,
  ) {
    const periodos = this.contexto.obtenerPeriodos(
      dto.anio,
      dto.mes,
      dto.cantidadMeses,
    );
    const empleados = await this.contexto.autorizarEquipo(
      usuario,
      dto.idEncargado,
    );
    return {
      idEncargado: dto.idEncargado,
      totalEmpleados: empleados.length,
      cantidadMeses: periodos.length,
      criterios: this.criterios(),
      empleados: await this.resumirPeriodos(empleados, periodos),
    };
  }

  async obtenerHistoricoEmpleado(
    dto: ConsultarHistoricoEmpleadoDto,
    usuario: UsuarioAnalitico,
  ) {
    const periodos = this.contexto.obtenerPeriodos(
      dto.anio,
      dto.mes,
      dto.cantidadMeses,
    );
    const empleado = await this.contexto.autorizarEmpleado(
      usuario,
      dto.idEmpleado,
    );
    const [resumen] = await this.resumirPeriodos([empleado], periodos);
    return {
      ...resumen,
      cantidadMeses: periodos.length,
      criterios: this.criterios(),
    };
  }

  private criterios() {
    return {
      configuracionKpi: 'ACTUAL_NO_HISTORIZADA',
      alcanceEquipo: 'SUBORDINADOS_DIRECTOS_ACTUALES_ACTIVOS',
      promedioDiario: 'MEDIA_NO_PONDERADA_DE_DIAS_CON_REGISTRO',
      total: 'SUMA_DESCRIPTIVA_NO_CALIFICACION_OFICIAL',
      diasSinRegistro: 'NO_IMPLICAN_CERO_NI_AUSENCIA_LABORAL',
    };
  }

  // Una consulta agregada para todo el equipo y todos los meses. Sin series ni JSON.
  private async consultarAgregados(
    ids: number[],
    periodos: PeriodoAnalitico[],
  ): Promise<AgregadoMensual[]> {
    if (!ids.length) return [];
    const filas = await this.metricaDiariaRepository
      .createQueryBuilder('diaria')
      .select('diaria.idEmpleado', 'idEmpleado')
      .addSelect('diaria.idMetrica', 'idMetrica')
      .addSelect("DATE_FORMAT(diaria.fecha, '%Y-%m')", 'periodo')
      .addSelect('SUM(diaria.valor)', 'total')
      .addSelect('AVG(diaria.valor)', 'promedioDiario')
      .addSelect('MIN(diaria.valor)', 'minimo')
      .addSelect('MAX(diaria.valor)', 'maximo')
      .addSelect('COUNT(DISTINCT diaria.fecha)', 'diasConDatos')
      .where('diaria.idEmpleado IN (:...ids)', { ids })
      .andWhere('diaria.fecha BETWEEN :inicio AND :fin', {
        inicio: periodos[0].fechaInicial,
        fin: periodos[periodos.length - 1].fechaFinal,
      })
      .groupBy('diaria.idEmpleado')
      .addGroupBy('diaria.idMetrica')
      .addGroupBy("DATE_FORMAT(diaria.fecha, '%Y-%m')")
      .orderBy('diaria.idEmpleado', 'ASC')
      .addOrderBy('periodo', 'ASC')
      .addOrderBy('diaria.idMetrica', 'ASC')
      .getRawMany<{ [K in keyof AgregadoMensual]: string | number }>();
    return filas.map((fila) => ({
      idEmpleado: Number(fila.idEmpleado),
      idMetrica: Number(fila.idMetrica),
      periodo: String(fila.periodo),
      total: numeroAnalitico(fila.total),
      promedioDiario: Number(numeroAnalitico(fila.promedioDiario).toFixed(4)),
      minimo: numeroAnalitico(fila.minimo),
      maximo: numeroAnalitico(fila.maximo),
      diasConDatos: Number(fila.diasConDatos),
    }));
  }

  private async resumirPeriodos(
    empleados: EmpleadoAnalitico[],
    periodos: PeriodoAnalitico[],
  ) {
    const agregados = await this.consultarAgregados(
      empleados.map((e) => e.idEmpleado),
      periodos,
    );
    const catalogo = await this.contexto.obtenerCatalogo(
      empleados,
      agregados.map((a) => a.idMetrica),
    );
    const indice = new Map<string, AgregadoMensual>();
    const observadas = new Map<number, Set<number>>();
    for (const fila of agregados) {
      indice.set(`${fila.idEmpleado}:${fila.periodo}:${fila.idMetrica}`, fila);
      const ids = observadas.get(fila.idEmpleado) ?? new Set<number>();
      ids.add(fila.idMetrica);
      observadas.set(fila.idEmpleado, ids);
    }
    return empleados.map((empleado) => {
      const metricas = this.metricasAplicables(
        empleado,
        catalogo,
        observadas.get(empleado.idEmpleado),
      );
      return {
        idEmpleado: empleado.idEmpleado,
        periodos: periodos.map((periodo) => {
          const metricasPeriodo = metricas.map((metrica) => {
            const fila = indice.get(
              `${empleado.idEmpleado}:${periodo.fechaInicial.slice(0, 7)}:${metrica.idMetrica}`,
            );
            return {
              ...metrica,
              tieneDatos: Boolean(fila),
              total: fila?.total ?? null,
              promedioDiario: fila?.promedioDiario ?? null,
              minimo: fila?.minimo ?? null,
              maximo: fila?.maximo ?? null,
              diasConDatos: fila?.diasConDatos ?? 0,
            };
          });
          return {
            periodo,
            tieneDatos: metricasPeriodo.some((m) => m.tieneDatos),
            metricas: metricasPeriodo,
          };
        }),
      };
    });
  }

  private metricasAplicables(
    empleado: EmpleadoAnalitico,
    catalogo: ContextoMetrica[],
    observadas = new Set<number>(),
  ) {
    return catalogo.filter(
      (m) =>
        observadas.has(m.idMetrica) ||
        (m.activa && m.idDepartamento === empleado.idDepartamento),
    );
  }

  private async detallarEmpleado(
    empleado: EmpleadoAnalitico,
    periodo: PeriodoAnalitico,
    idMetrica?: number,
  ) {
    const registros = await this.metricaDiariaRepository.find({
      select: {
        idMetrica: true,
        fecha: true,
        valor: true,
        fuente: true,
        desgloseOrigen: true,
      },
      where: {
        idEmpleado: empleado.idEmpleado,
        fecha: Between(periodo.fechaInicial, periodo.fechaFinal),
        ...(idMetrica === undefined ? {} : { idMetrica }),
      },
      order: { idMetrica: 'ASC', fecha: 'ASC' },
    });
    const catalogo = await this.contexto.obtenerCatalogo(
      [empleado],
      registros.map((r) => r.idMetrica),
    );
    const series = new Map<
      number,
      Array<{
        fecha: string;
        valor: number;
        fuente: string;
        desgloseOrigen: Array<
          Omit<DesgloseOrigen, 'valor'> & { valor: number }
        > | null;
      }>
    >();
    for (const registro of registros) {
      const serie = series.get(registro.idMetrica) ?? [];
      serie.push({
        fecha: registro.fecha,
        valor: numeroAnalitico(registro.valor),
        fuente: registro.fuente,
        desgloseOrigen:
          registro.desgloseOrigen?.map((d) => ({
            origen: d.origen,
            valor: numeroAnalitico(d.valor),
          })) ?? null,
      });
      series.set(registro.idMetrica, serie);
    }
    const metricas = this.metricasAplicables(
      empleado,
      catalogo,
      new Set(series.keys()),
    )
      .filter((m) => idMetrica === undefined || m.idMetrica === idMetrica)
      .map((metrica) => {
        const serieDiaria = series.get(metrica.idMetrica) ?? [];
        return {
          ...metrica,
          tieneDatos: serieDiaria.length > 0,
          diasConDatos: new Set(serieDiaria.map((p) => p.fecha)).size,
          serieDiaria,
        };
      });
    return {
      idEmpleado: empleado.idEmpleado,
      periodo,
      tieneDatos: registros.length > 0,
      criterios: this.criterios(),
      metricas,
    };
  }

  async obtenerMetricasEquipo(idEncargado: number, anio: number, mes: number) {
    const encargado = await this.empleadoRepository.findOne({
      select: { idEmpleado: true },
      where: {
        idEmpleado: idEncargado,
        isActive: true,
      },
    });

    if (!encargado) {
      throw new NotFoundException('No se encontrÃ³ el empleado encargado');
    }

    const subordinados = await this.empleadoRepository.find({
      select: {
        idEmpleado: true,
        primerNombre: true,
        segundoNombre: true,
        primerApellido: true,
        segundoApellido: true,
      },
      where: {
        jefeDirecto: {
          idEmpleado: idEncargado,
        },
        isActive: true,
      },
    });

    const { fechaInicial, fechaFinal } = this.contexto.obtenerPeriodo(
      anio,
      mes,
    );

    if (subordinados.length === 0) {
      return {
        idEncargado,
        periodo: {
          anio,
          mes,
          fechaInicial,
          fechaFinal,
        },
        totalEmpleados: 0,
        empleados: [],
      };
    }

    const idsEmpleados = subordinados.map((empleado) => empleado.idEmpleado);

    const registros = await this.metricaDiariaRepository.find({
      select: {
        idEmpleado: true,
        idMetrica: true,
        fecha: true,
        valor: true,
        desgloseOrigen: true,
      },
      where: {
        idEmpleado: In(idsEmpleados),
        fecha: Between(fechaInicial, fechaFinal),
      },
      order: {
        fecha: 'ASC',
      },
    });

    const idsMetricas = [
      ...new Set(registros.map((registro) => registro.idMetrica)),
    ];

    const metricas = idsMetricas.length
      ? await this.metricaKpiRepository.find({
          where: {
            idMetrica: In(idsMetricas),
          },
        })
      : [];

    const mapaMetricas = new Map(
      metricas.map((metrica) => [metrica.idMetrica, metrica]),
    );

    const empleados = subordinados.map((empleado) => {
      const registrosEmpleado = registros.filter(
        (registro) => registro.idEmpleado === empleado.idEmpleado,
      );

      const metricasEmpleado = new Map<number, MetricaEquipo>();

      for (const registro of registrosEmpleado) {
        if (!metricasEmpleado.has(registro.idMetrica)) {
          const configuracion = mapaMetricas.get(registro.idMetrica);

          metricasEmpleado.set(registro.idMetrica, {
            idMetrica: registro.idMetrica,

            codigo: configuracion?.codigoKpi ?? null,

            nombre: configuracion?.nombreKpi ?? null,

            unidadMedida: configuracion?.unidadMedida ?? null,

            metaObjetivo:
              configuracion?.metaObjetivo != null
                ? Number(configuracion.metaObjetivo)
                : null,

            pesoPorcentaje:
              configuracion?.pesoPorcentaje != null
                ? Number(configuracion.pesoPorcentaje)
                : null,

            serieDiaria: [],
          });
        }

        metricasEmpleado.get(registro.idMetrica)!.serieDiaria.push({
          fecha: registro.fecha,
          valor: Number(registro.valor),
          desgloseOrigen: registro.desgloseOrigen ?? null,
        });
      }

      return {
        empleado: {
          idEmpleado: empleado.idEmpleado,

          nombre: [
            empleado.primerNombre,
            empleado.segundoNombre,
            empleado.primerApellido,
            empleado.segundoApellido,
          ]
            .filter(Boolean)
            .join(' '),
        },

        metricas: Array.from(metricasEmpleado.values()),
      };
    });

    return {
      idEncargado,

      periodo: {
        anio,
        mes,
        fechaInicial,
        fechaFinal,
      },

      totalEmpleados: subordinados.length,

      empleados,
    };
  }
}
