import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiToolsController } from './controllers/ai-tools.controller';
import { AiToolsLegacyController } from './controllers/ai-tools-legacy.controller';
import { AiToolsService } from './services/ai-tools.service';
import { AiContextService } from './services/ai-context.service';
import { AuthModule } from '../auth/auth.module';

import { Empleado } from '../organization/empleados/entities/empleado.entity';
import { MetricaKpi } from '../performance/entities/metrica-kpi.entity';
import { MetricaKpiDiaria } from '../performance/entities/metrica-kpi-diaria.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Empleado, MetricaKpi, MetricaKpiDiaria]),
  ],

  controllers: [AiToolsController, AiToolsLegacyController],

  providers: [AiToolsService, AiContextService],

  exports: [AiToolsService],
})
export class AiModule {}
