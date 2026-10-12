import { cumplimientoReal } from './cumplimiento-kpi';
import { agruparDesgloseMensual } from '../utils/desglose-origen';
import { DetalleResultadoKpi } from '../entities/detalle-resultado-kpi.entity';
import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import {
  Between,
  Repository,
} from 'typeorm';

import { MetricaKpiDiaria } from '../entities/metrica-kpi-diaria.entity';
import { EvaluacionDesempeno } from '../../performance/entities/evaluacion-desempeno.entity';
import { ResultadoKpi } from '../../performance/entities/resultado-kpi.entity';
import { RangoKpi } from '../../performance/entities/rango-kpi.entity';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { Departamento } from '../../organization/departamentos/entities/departamento.entity';
import { MetricaKpi } from '../entities/metrica-kpi.entity';
import { aplicarCincoS, asegurarMetricaCincoS, codigoCincoS } from '../../kpi/cinco-s/cinco-s.integracion';

@Injectable()
export class EvaluacionKpiService {

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

  ) {}

  async procesarEvaluacionesDepartamento(idDepartamento: number, anio: number, mes: number) {
    const manager = this.evaluacionRepository.manager;
    const departamento = await manager.getRepository(Departamento).findOne({
      where: { idDepartamento, isActive: true },
    });
    if (!departamento) {
      throw new NotFoundException('El departamento no existe o está inactivo.');
    }
    const empleados = await manager.getRepository(Empleado).find({
      select: { idEmpleado: true },
      where: { isActive: true, puesto: { idDepartamento } },
      order: { idEmpleado: 'ASC' },
    });
    const evaluaciones: Awaited<ReturnType<EvaluacionKpiService['procesarEvaluacionMensual']>>[] = [];
    const empleadosSinDatos: number[] = [];
    const errores: { idEmpleado: number; mensaje: string }[] = [];
    for (const empleado of empleados) {
      try {
        const evaluacion = await manager.transaction(async transaccion => {
          const servicio = new EvaluacionKpiService(
            transaccion.getRepository(MetricaKpiDiaria),
            transaccion.getRepository(EvaluacionDesempeno),
            transaccion.getRepository(ResultadoKpi),
            transaccion.getRepository(RangoKpi),
          );
          await transaccion.getRepository(Departamento).findOne({
            where: { idDepartamento }, lock: { mode: 'pessimistic_write' },
          });
          return servicio.calcularEvaluacionMensual(empleado.idEmpleado, idDepartamento, anio, mes);
        });
        evaluaciones.push(evaluacion);
      } catch (error) {
        if (error instanceof NotFoundException) {
          empleadosSinDatos.push(empleado.idEmpleado);
        } else {
          Logger.error(
            `Error evaluando al empleado ${empleado.idEmpleado}`,
            error instanceof Error ? error.stack : undefined,
            EvaluacionKpiService.name,
          );
          errores.push({ idEmpleado: empleado.idEmpleado, mensaje: 'No se pudo guardar la evaluación.' });
        }
      }
    }
    return {
      idDepartamento, periodo: { anio, mes },
      empleadosEncontrados: empleados.length, empleadosEvaluados: evaluaciones.length,
      empleadosSinDatos, errores, evaluaciones,
    };
  }

  async procesarEvaluacionMensual(
    idEmpleado: number, idDepartamento: number, anio: number, mes: number,
  ) {
    return this.evaluacionRepository.manager.transaction(async manager => {
      const departamento = await manager.getRepository(Departamento).findOne({
        where: { idDepartamento, isActive: true }, lock: { mode: 'pessimistic_write' },
      });
      if (!departamento) throw new NotFoundException('El departamento no existe o está inactivo.');
      const servicio = new EvaluacionKpiService(
        manager.getRepository(MetricaKpiDiaria), manager.getRepository(EvaluacionDesempeno),
        manager.getRepository(ResultadoKpi), manager.getRepository(RangoKpi),
      );
      return servicio.calcularEvaluacionMensual(idEmpleado, idDepartamento, anio, mes);
    });
  }

  /** Uso interno: el llamador debe mantener una transacción y el bloqueo del departamento. */
  async calcularEvaluacionMensual(
    idEmpleado: number,
    idDepartamento: number,
    anio: number,
    mes: number,
  ) {

    const fechaInicial =
      `${anio}-${String(mes).padStart(2, '0')}-01`;

    const ultimoDia =
      new Date(anio, mes, 0).getDate();

    const fechaFinal =
      `${anio}-${String(mes).padStart(2, '0')}-${String(
        ultimoDia,
      ).padStart(2, '0')}`;

    /*
     *  Obtener métricas diarias
     */
    const registrosDiarios =
      await this.metricaDiariaRepository.find({
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
      await this.evaluacionRepository.findOne({
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
        this.evaluacionRepository.create({
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
        await this.evaluacionRepository.save(
          evaluacion,
        );
    }

    /*
     * 3. Agrupar métricas por KPI
     */
    const grupos = new Map<
      number,
      {
        metrica: any;
        valores: number[];
      }
    >();

    for (const registro of registrosDiarios) {

      const idMetrica =
        registro.idMetrica;

      let grupo =
        grupos.get(idMetrica);

      if (!grupo) {

        grupo = {
          metrica: registro.metrica,
          valores: [],
        };

        grupos.set(
          idMetrica,
          grupo,
        );
      }

      grupo.valores.push(
        Number(registro.valor),
      );
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

      const valorMensual =
        this.calcularValorMensual(
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
        );

      const porcentajeCumplimiento = cumplimientoReal(valorMensual, grupo.metrica.metaObjetivo, codigoKpi);

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
        await this.resultadoRepository.findOne({
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
          this.resultadoRepository.create({
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

      resultado = await this.resultadoRepository.save(
        resultado,
      );

      let detalleEstado: string | undefined;
      if (codigoKpi === 'BOD_ARTICULOS') {
        const desglose = agruparDesgloseMensual(registrosDiarios.filter(r => r.idMetrica === grupo.metrica.idMetrica));
        const detalles = this.evaluacionRepository.manager.getRepository(DetalleResultadoKpi);
        await detalles.delete({ idResultado: resultado.idResultado });
        if (desglose) {
          await detalles.save(desglose.map(item => detalles.create({
            idResultado: resultado.idResultado, origen: item.origen,
            valor: item.valor, descripcion: null,
          })));
        }
        detalleEstado = desglose ? 'COMPLETO' : 'REQUIERE_REPROCESAR_ETL';
      }

      resultadosProcesados.push({
        detalleEstado,
        codigoKpi,
        valorMensual,
        meta:
          grupo.metrica.metaObjetivo,

        porcentajeCumplimiento,
        puntosObtenidos,

        rangoEncontrado:
          rango !== null,
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

    await this.evaluacionRepository.save(
      evaluacion,
    );

    const manager = this.evaluacionRepository.manager;
    const esBodega = registrosDiarios.some(r => r.metrica.codigoKpi.startsWith('BOD_'));
    const metricaCincoS = esBodega
      ? await asegurarMetricaCincoS(manager, idDepartamento)
      : await manager.getRepository(MetricaKpi).findOne({ where: { codigoKpi: codigoCincoS(idDepartamento), isActive: true } });
    const cincoS = metricaCincoS ? await aplicarCincoS(manager, evaluacion, metricaCincoS, false) : null;
    if (cincoS?.completo) {
      resultadosProcesados.push({ codigoKpi: metricaCincoS!.codigoKpi,
        valorMensual: cincoS.promedio, meta: '100', porcentajeCumplimiento: cincoS.promedio,
        puntosObtenidos: cincoS.puntosKpi, rangoEncontrado: false });
    }

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

      puntajeBase: Number(evaluacion.puntajeBase),

      penalizacionTotal,

      notaFinal: Number(evaluacion.notaFinal),
      estado: evaluacion.estado,
      cincoS,

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
  ): Promise<RangoKpi | null> {

    return this.rangoRepository
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
