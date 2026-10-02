import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiToolsController } from './controllers/AI-tools.controller';
import { AiToolsService } from './services/IA-tools.service';

import { Empleado } from '../organization/empleados/entities/empleado.entity';
import { MetricaKpi } from '../performance/entities/metrica-kpi.entity';
import { MetricaKpiDiaria } from '../performance/entities/metrica-kpi-diaria.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Empleado, MetricaKpi, MetricaKpiDiaria])],

  controllers: [AiToolsController],

  providers: [AiToolsService],

  exports: [AiToolsService],
})
export class IAModule {}
