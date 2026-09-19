import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SapModule } from '../integrations/sap/sap.module';
import { Empleado } from '../organization/empleados/entities/empleado.entity';

import { PerformanceController } from './performance.controller';
import { EvaluacionKpiController } from './controller/evaluacion-kpi.controller';

import { PerformanceService } from './services/performance.service';
import { EvaluacionKpiService } from './services/evaluacion-kpi.service';

import { MetricaKpi } from './entities/metrica-kpi.entity';
import { MetricaKpiDiaria } from './entities/metrica-kpi-diaria.entity';
import { RangoKpi } from './entities/rango-kpi.entity';
import { EvaluacionDesempeno } from './entities/evaluacion-desempeno.entity';
import { ResultadoKpi } from './entities/resultado-kpi.entity';
import { DetalleResultadoKpi } from './entities/detalle-resultado-kpi.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MetricaKpi,
      MetricaKpiDiaria,
      RangoKpi,
      EvaluacionDesempeno,
      ResultadoKpi,
      DetalleResultadoKpi,
      Empleado,
    ]),

    SapModule,
  ],

  controllers: [
    PerformanceController,
    EvaluacionKpiController,
  ],

  providers: [
    PerformanceService,
    EvaluacionKpiService,
  ],

  exports: [
    PerformanceService,
    EvaluacionKpiService,
  ],
})
export class PerformanceModule {}
