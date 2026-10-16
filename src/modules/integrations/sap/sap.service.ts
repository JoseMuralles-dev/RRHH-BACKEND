import { ServiceUnavailableException } from '@nestjs/common';
import type { VentasSap } from './interfaces/ventas-sap.interface';
import {Injectable, InternalServerErrorException,} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';
import { MetricaBodegaSap } from './interfaces/metrica-bodega-sap.interface';

@Injectable()
export class SapService {

  constructor(
    private readonly configService: ConfigService,
  ) {}

  private async getConnection(): Promise<sql.ConnectionPool> {

    const config: sql.config = {
      server: this.configService.getOrThrow<string>('SAP_DB_HOST'),

      port: Number(
        this.configService.get<string>('SAP_DB_PORT') ?? 1433,
      ),

      user: this.configService.getOrThrow<string>('SAP_DB_USER'),

      password:
        this.configService.getOrThrow<string>('SAP_DB_PASSWORD'),

      database:
        this.configService.getOrThrow<string>('SAP_DB_DATABASE'),

      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    };

    const pool = new sql.ConnectionPool(config);

    return pool.connect();
  }


  async obtenerKpiVentas(fechaInicio: string, fechaFin: string, slpCode: number | null = null): Promise<VentasSap[]> {
    let pool: sql.ConnectionPool | undefined;
    try {
      pool = await this.getConnection();
      const respuesta = await pool.request()
        .input('FechaInicio', sql.Date, fechaInicio)
        .input('FechaFin', sql.Date, fechaFin)
        .input('SlpCode', sql.Int, slpCode)
        .execute('dbo.usp_RRHH_KpiVentas');
      if (!Array.isArray(respuesta.recordset)) throw new Error('Contrato SAP invalido');
      return respuesta.recordset as VentasSap[];
    } catch {
      throw new ServiceUnavailableException({ estado: 'SAP_NO_DISPONIBLE', message: 'No fue posible consultar KPI de Ventas en SAP' });
    } finally {
      if (pool) await pool.close();
    }
  }

  async obtenerMetricasBodega(
    fechaInicial: string,
    fechaFinal: string,
  ): Promise<MetricaBodegaSap[]> {

    let pool: sql.ConnectionPool | undefined;

    try {

      pool = await this.getConnection();

      const resultado = await pool
        .request()

        .input(
          'FechaInicial',
          sql.Date,
          fechaInicial,
        )

        .input(
          'FechaFinal',
          sql.Date,
          fechaFinal,
        )

        .execute(
          '_SBOSP_RPT_Reporte_Tracking_Bodega_ETL',
        );

      return resultado.recordset as MetricaBodegaSap[];

    } catch (error) {

      console.error(
        'Error consultando SAP:',
        error,
      );

      throw new InternalServerErrorException(
        'No fue posible obtener las métricas desde SAP',
      );

    } finally {

      if (pool) {
        await pool.close();
      }
    }
  }
}