import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { SapService } from '../../integrations/sap/sap.service';

import { MetricaKpi } from '../entities/metrica-kpi.entity';
import { MetricaKpiDiaria } from '../entities/metrica-kpi-diaria.entity';

import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { DesgloseOrigen } from '../interfaces/desglose-origen.interface';
import { crearDesglose, sumarDesglose } from '../utils/desglose-origen';

@Injectable()
export class PerformanceService {

  constructor(
    private readonly sapService: SapService,

    @InjectRepository(MetricaKpi)
    private readonly metricaRepository:
      Repository<MetricaKpi>,

    @InjectRepository(MetricaKpiDiaria)
    private readonly metricaDiariaRepository:
      Repository<MetricaKpiDiaria>,

    @InjectRepository(Empleado)
    private readonly empleadoRepository:
      Repository<Empleado>,
  ) {}

  async procesarMetricasBodega(
    fecha: string,
  ) {

    // =========================================
    // 1. EXTRAER DATOS DESDE SAP
    // =========================================

    const datosSap =
      await this.sapService.obtenerMetricasBodega(
        fecha,
        fecha,
      );

    // =========================================
    // 2. DEFINIR LAS MÉTRICAS DE BODEGA
    // =========================================

    const codigosMetricas = [
      'BOD_FACTURAS',
      'BOD_LINEAS',
      'BOD_ARTICULOS',
      'BOD_TIEMPO_PREP',
    ];

    // =========================================
    // 3. BUSCAR LAS MÉTRICAS EN MYSQL
    // =========================================

    const metricas =
      await this.metricaRepository.find({
        where: {
          codigoKpi: In(codigosMetricas),
          isActive: true,
        },
      });

    // =========================================
    // 4. CREAR MAPA DE MÉTRICAS
    // =========================================

    const mapaMetricas =
      new Map(
        metricas.map(
          metrica => [
            metrica.codigoKpi,
            metrica,
          ],
        ),
      );

    // =========================================
    // 5. RESULTADO DEL PROCESO ETL
    // =========================================

    const resultado = {
      filasSap: datosSap.length,
      empleadosProcesados: 0,
      registrosProcesados: 0,
      empleadosSinRelacion: [] as {
        codigoEmpleadoSap: number | null;
        nombrePreparador: string;
      }[],
    };

    // =========================================
    // 6. RECORRER PREPARADORES DEVUELTOS POR SAP
    // =========================================

    for (const fila of datosSap) {
      const codigoSapTexto = String(fila.CodigoEmpleadoSap ?? '').trim();
      const codigoSap = Number(codigoSapTexto);

      if (!codigoSapTexto || !Number.isSafeInteger(codigoSap)) {
        resultado.empleadosSinRelacion.push({
          codigoEmpleadoSap: null,
          nombrePreparador: fila.NombrePreparador,
        });
        continue;
      }

      // Buscar el empleado local
      // utilizando OHEM.empID
      const empleado =
        await this.empleadoRepository.findOne({
          where: {
            codigoSapEmpleado:
              codigoSap,
          },
        });

      // Si SAP tiene al preparador
      // pero RRHH todavía no tiene la relación
      if (!empleado) {

        resultado.empleadosSinRelacion.push({
          codigoEmpleadoSap:
            codigoSap,

          nombrePreparador:
            fila.NombrePreparador,
        });

        continue;
      }

      resultado.empleadosProcesados++;

      // =========================================
      // 7. TRANSFORMAR FILA SAP
      //    EN MÉTRICAS DEL SISTEMA
      // =========================================

      const desgloseArticulos = crearDesglose(
        fila.TotalArticulos,
        fila.TotalArticulosTraslados,
      );
      const valores: { codigo: string; valor: number; desglose?: DesgloseOrigen[] }[] = [
        {
          codigo: 'BOD_FACTURAS',
          valor: fila.CantidadFacturas,
        },
        {
          codigo: 'BOD_LINEAS',
          valor: fila.TotalLineas,
        },
        {
          codigo: 'BOD_ARTICULOS',
          valor: Number(sumarDesglose(desgloseArticulos)),
          desglose: desgloseArticulos,
        },
        {
          codigo: 'BOD_TIEMPO_PREP',
          valor:
            fila.PromedioTiempoPreparacionMinutos,
        },
      ];

      // =========================================
      // 8. GUARDAR CADA MÉTRICA
      // =========================================

      for (const item of valores) {

        const metrica =
          mapaMetricas.get(item.codigo);

        if (!metrica) {
          continue;
        }

        if (metrica.idMetrica == null) {
          throw new InternalServerErrorException(
            `La métrica ${item.codigo} no tiene un identificador válido`,
          );
        }

        await this.guardarMetricaDiaria(
          empleado.idEmpleado,
          metrica.idMetrica,
          fecha,
          Number(item.valor),
          item.desglose,
        );

        resultado.registrosProcesados++;
      }
    }

    // =========================================
    // 9. DEVOLVER RESUMEN DEL ETL
    // =========================================

    return resultado;
  }


  // =========================================
  // INSERTAR O ACTUALIZAR MÉTRICA DIARIA
  // =========================================

  private async guardarMetricaDiaria(
    idEmpleado: number,
    idMetrica: number,
    fecha: string,
    valor: number,
    desglose?: DesgloseOrigen[],
  ) {

    const existente =
      await this.metricaDiariaRepository.findOne({
        where: {
          idEmpleado,
          idMetrica,
          fecha,
        },
      });

    // Si ya existe la métrica de ese empleado
    // para ese día, actualizamos el valor.
    if (existente) {

      existente.valor =
        String(valor);
      existente.desgloseOrigen = desglose ?? null;

      existente.fuente =
        'SAP';

      await this.metricaDiariaRepository.save(
        existente,
      );

      return;
    }

    // Si no existe, creamos un registro nuevo.
    const nueva =
      this.metricaDiariaRepository.create({
        idEmpleado,
        idMetrica,
        fecha,
        valor: String(valor),
        desgloseOrigen: desglose ?? null,
        fuente: 'SAP',
      });

    await this.metricaDiariaRepository.save(
      nueva,
    );
  }

  
}
