import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import {
  Between,
  EntityManager,
  In,
  Repository,
} from 'typeorm';

import { MetricaKpiDiaria } from '../entities/metrica-kpi-diaria.entity';
import { EvaluacionDesempeno } from '../entities/evaluacion-desempeno.entity';
import { ResultadoKpi } from '../entities/resultado-kpi.entity';
import { MetricaKpi } from '../entities/metrica-kpi.entity';
import { RangoKpi } from '../entities/rango-kpi.entity';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { Departamento } from '../../organization/departamentos/entities/departamento.entity';
import { DetalleResultadoKpi } from '../entities/detalle-resultado-kpi.entity';
import { agruparDesgloseMensual, sumarDesglose } from '../utils/desglose-origen';

@Injectable()
export class EvaluacionKpiService {
  private readonly logger = new Logger(EvaluacionKpiService.name);

  constructor(

    @InjectRepository(MetricaKpiDiaria)
    private readonly metricaDiariaRepository:
      Repository<MetricaKpiDiaria>,

    @InjectRepository(EvaluacionDesempeno)
    private readonly evaluacionRepository:
      Repository<EvaluacionDesempeno>,

    @InjectRepository(ResultadoKpi)
    private readonly resultadoRepository:
      Repository<ResultadoKpi>,

    @InjectRepository(RangoKpi)
    private readonly rangoRepository:
      Repository<RangoKpi>,

    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,

  ) {}

  async procesarEvaluacionesDepartamento(
    idDepartamento: number,
    anio: number,
    mes: number,
  ) {
    const departamento = await this.empleadoRepository.manager
      .getRepository(Departamento)
      .findOne({ where: { idDepartamento, isActive: true } });

    if (!departamento) {
      throw new NotFoundException('El departamento no existe o está inactivo.');
    }

    const empleados = await this.empleadoRepository.find({
      select: { idEmpleado: true },
      where: { isActive: true, puesto: { idDepartamento } },
      order: { idEmpleado: 'ASC' },
    });

    const evaluaciones: Awaited<ReturnType<
      EvaluacionKpiService['procesarEvaluacionMensual']
    >>[] = [];
    const empleadosSinDatos: number[] = [];
    const errores: { idEmpleado: number; mensaje: string }[] = [];

    for (const empleado of empleados) {
      try {
        evaluaciones.push(await this.procesarEvaluacionMensual(
          empleado.idEmpleado, idDepartamento, anio, mes,
        ));
      } catch (error) {
        if (error instanceof NotFoundException) {
          empleadosSinDatos.push(empleado.idEmpleado);
        } else {
          this.logger.error(
            `Error evaluando al empleado ${empleado.idEmpleado}`,
            error instanceof Error ? error.stack : undefined,
          );
          errores.push({
            idEmpleado: empleado.idEmpleado,
            mensaje: 'No se pudo guardar la evaluación. Consulta el registro del servidor.',
          });
        }
      }
    }

    return {
      idDepartamento,
      periodo: { anio, mes },
      empleadosEncontrados: empleados.length,
      empleadosEvaluados: evaluaciones.length,
      empleadosSinDatos,
      errores,
      evaluaciones,
    };
  }

  async procesarEvaluacionMensual(
    idEmpleado: number,
    idDepartamento: number,
    anio: number,
    mes: number,
  ) {
    return this.evaluacionRepository.manager.transaction(manager =>
      this.calcularEvaluacionMensual(idEmpleado, idDepartamento, anio, mes, manager),
    );
  }

  private async calcularEvaluacionMensual(
    idEmpleado: number,
    idDepartamento: number,
    anio: number,
    mes: number,
    manager: EntityManager,
  ) {
    const metricaDiariaRepository = manager.getRepository(MetricaKpiDiaria);
    const evaluacionRepository = manager.getRepository(EvaluacionDesempeno);
    const resultadoRepository = manager.getRepository(ResultadoKpi);
    const detalleRepository = manager.getRepository(DetalleResultadoKpi);

    const fechaInicial =
      `${anio}-${String(mes).padStart(2, '0')}-01`;

    const ultimoDia =
      new Date(anio, mes, 0).getDate();

    const fechaFinal =
      `${anio}-${String(mes).padStart(2, '0')}-${String(
        ultimoDia,
      ).padStart(2, '0')}`;

    /*
     * 1. Obtener métricas diarias
     */
    const registrosDiarios =
      await metricaDiariaRepository.find({
        where: {
          idEmpleado,
          metrica: { idDepartamento, isActive: true },
          fecha: Between(
            fechaInicial,
            fechaFinal,
          ),
        },

        relations: {
          metrica: true,
        },
      });

    if (registrosDiarios.length === 0) {
      throw new NotFoundException(
        'No existen métricas diarias para este empleado en el período indicado.',
      );
    }

    /*
     * 2. Buscar o crear evaluación mensual
     */
    let evaluacion =
      await evaluacionRepository.findOne({
        where: {
          idEmpleado,
          idDepartamento,
          periodoAnio: anio,
          periodoMes: mes,
          isActive: true,
        },
      });

    if (!evaluacion) {

      evaluacion =
        evaluacionRepository.create({
          idEmpleado,
          idDepartamento,

          periodoAnio: anio,
          periodoMes: mes,

          puntajeBase: '0',
          penalizacionTotal: '0',
          notaFinal: '0',

          metaGlobal: '100',

          estado: 'BORRADOR',

          isActive: true,
        });

      evaluacion =
        await evaluacionRepository.save(
          evaluacion,
        );
    }

    /*
     * 3. Agrupar métricas por KPI
     */
    const grupos = new Map<
      number,
      {
        metrica: MetricaKpi;
        valores: number[];
        registros: MetricaKpiDiaria[];
      }
    >();

    for (const registro of registrosDiarios) {

      const idMetrica =
        registro.idMetrica;

      if (idMetrica == null || !registro.metrica) {
        throw new InternalServerErrorException(
          'Una métrica diaria no tiene identificador o relación de KPI válida.',
        );
      }

      let grupo =
        grupos.get(idMetrica);

      if (!grupo) {

        grupo = {
          metrica: registro.metrica,
          valores: [],
          registros: [],
        };

        grupos.set(
          idMetrica,
          grupo,
        );
      }

      grupo.valores.push(
        Number(registro.valor),
      );
      grupo.registros.push(registro);
    }

    let puntajeBase = 0;

    const penalizacionTotal = 0;

    const resultadosProcesados: any[] = [];

    /*
     * 4. Procesar cada KPI
     */
    for (const grupo of grupos.values()) {

      const codigoKpi =
        grupo.metrica.codigoKpi;

      if (grupo.metrica.idMetrica == null || !codigoKpi) {
        throw new InternalServerErrorException(
          'La métrica no tiene identificador o código KPI válido.',
        );
      }

      const requiereDesglose = codigoKpi === 'BOD_ARTICULOS';
      const desglose = requiereDesglose
        ? agruparDesgloseMensual(grupo.registros)
        : null;
      const valorMensual = desglose
        ? Number(sumarDesglose(desglose))
        : this.calcularValorMensual(
          codigoKpi,
          grupo.valores,
        );

      /*
       * 5. Buscar rango
       */
      const rango =
        await this.buscarRango(
          grupo.metrica.idMetrica,
          valorMensual,
          manager,
        );

      const porcentajeCumplimiento =
        rango
          ? Number(
              rango.porcentajeCumplimiento,
            )
          : null;

      const puntosObtenidos =
        rango
          ? Number(
              rango.puntosOtorgados,
            )
          : 0;

      puntajeBase += puntosObtenidos;

      /*
       * 6. Buscar resultado existente
       */
      let resultado =
        await resultadoRepository.findOne({
          where: {
            idEvaluacionDesempeno:
              evaluacion.idEvaluacionDesempeno,

            idMetrica:
              grupo.metrica.idMetrica,

            isActive: true,
          },
        });

      if (!resultado) {

        resultado =
          resultadoRepository.create({
            idEvaluacionDesempeno:
              evaluacion.idEvaluacionDesempeno,

            idMetrica:
              grupo.metrica.idMetrica,

            valorObtenido:
              valorMensual.toFixed(2),

            metaAplicada:
              grupo.metrica.metaObjetivo,

            porcentajeCumplimiento:
              porcentajeCumplimiento !== null
                ? porcentajeCumplimiento.toFixed(2)
                : null,

            puntosObtenidos:
              puntosObtenidos.toFixed(2),

            cantidadEventos: 0,

            penalizacionGenerada: '0',

            observacion:
              rango
                ? null
                : 'No existe rango configurado para el valor obtenido.',

            isActive: true,
          });

      } else {

        resultado.valorObtenido =
          valorMensual.toFixed(2);

        resultado.metaAplicada =
          grupo.metrica.metaObjetivo;

        resultado.porcentajeCumplimiento =
          porcentajeCumplimiento !== null
            ? porcentajeCumplimiento.toFixed(2)
            : null;

        resultado.puntosObtenidos =
          puntosObtenidos.toFixed(2);

        resultado.observacion =
          rango
            ? null
            : 'No existe rango configurado para el valor obtenido.';
      }

      const resultadoGuardado = await resultadoRepository.save(
        resultado,
      );

      if (requiereDesglose) {
        // Reemplazar solo los orígenes administrados por este ETL.
        // La transacción revierte tanto el resultado como sus detalles si falla.
        await detalleRepository.delete({
          idResultado: resultadoGuardado.idResultado,
          origen: In(['FACTURAS', 'TRASLADOS']),
        });
        if (desglose) {
          await detalleRepository.save(desglose.map(item =>
            detalleRepository.create({
              idResultado: resultadoGuardado.idResultado,
              origen: item.origen,
              valor: item.valor,
              descripcion: item.origen === 'FACTURAS'
                ? 'Artículos provenientes de facturas'
                : 'Artículos provenientes de traslados',
            }),
          ));
        }
      }

      resultadosProcesados.push({
        codigoKpi,
        valorMensual,
        meta:
          grupo.metrica.metaObjetivo,

        porcentajeCumplimiento,
        puntosObtenidos,

        rangoEncontrado:
          rango !== null,
        detalleEstado: requiereDesglose
          ? (desglose ? 'COMPLETO' : 'REQUIERE_REPROCESAR_ETL')
          : 'NO_APLICA',
        detalle: desglose ?? [],
      });
    }

    /*
     * 7. Actualizar evaluación general
     */
    evaluacion.puntajeBase =
      puntajeBase.toFixed(2);

    evaluacion.penalizacionTotal =
      penalizacionTotal.toFixed(2);

    evaluacion.notaFinal =
      (
        puntajeBase -
        penalizacionTotal
      ).toFixed(2);

    evaluacion.estado =
      'CALCULADA';

    await evaluacionRepository.save(
      evaluacion,
    );

    /*
     * 8. Respuesta
     */
    return {

      idEvaluacion:
        evaluacion.idEvaluacionDesempeno,

      idEmpleado,

      periodo: {
        anio,
        mes,
      },

      puntajeBase,

      penalizacionTotal,

      notaFinal:
        puntajeBase -
        penalizacionTotal,

      resultados:
        resultadosProcesados,
    };
  }

  private calcularValorMensual(
    codigoKpi: string,
    valores: number[],
  ): number {

    if (valores.length === 0) {
      return 0;
    }

    switch (codigoKpi) {

      case 'BOD_FACTURAS':

      case 'BOD_LINEAS':

      case 'BOD_ARTICULOS':

        return valores.reduce(
          (total, valor) =>
            total + valor,
          0,
        );

      case 'BOD_TIEMPO_PREP':

        return (
          valores.reduce(
            (total, valor) =>
              total + valor,
            0,
          ) /
          valores.length
        );

      default:

        return valores.reduce(
          (total, valor) =>
            total + valor,
          0,
        );
    }
  }

  private async buscarRango(
    idMetrica: number,
    valor: number,
    manager: EntityManager,
  ): Promise<RangoKpi | null> {

    return manager.getRepository(RangoKpi)
      .createQueryBuilder('rango')

      .where(
        'rango.id_metrica = :idMetrica',
        {
          idMetrica,
        },
      )

      .andWhere(
        'rango.is_active = 1',
      )

      .andWhere(
        ':valor BETWEEN rango.valor_minimo AND rango.valor_maximo',
        {
          valor,
        },
      )

      .orderBy(
        'rango.orden',
        'ASC',
      )

      .getOne();
  }
}
