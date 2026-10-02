import { Injectable, NotFoundException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';

import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { MetricaKpi } from '../../performance/entities/metrica-kpi.entity';
import { MetricaKpiDiaria } from '../../performance/entities/metrica-kpi-diaria.entity';

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
  ) {}

  async obtenerMetricasEquipo(idEncargado: number, anio: number, mes: number) {
    const encargado = await this.empleadoRepository.findOne({
      where: {
        idEmpleado: idEncargado,
        isActive: true,
      },
    });

    if (!encargado) {
      throw new NotFoundException('No se encontrÃ³ el empleado encargado');
    }

    const subordinados = await this.empleadoRepository.find({
      where: {
        jefeDirecto: {
          idEmpleado: idEncargado,
        },
        isActive: true,
      },
    });

    const prefijoFecha = `${anio}-${String(mes).padStart(2, '0')}`;
    const fechaInicial = `${prefijoFecha}-01`;
    const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    const fechaFinal = `${prefijoFecha}-${ultimoDia}`;

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

