import { ConfigModule } from '@nestjs/config';
import { Usuario } from '../user/entities/user.entity';
import { AiToolsAuthGuard } from './guards/ai-tools-auth.guard';
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
import { AiController } from './controllers/ai.controller';
import { AiService } from './services/ai.service';
import { AiInforme } from './entities/ai-informe.entity';
import { AiActorService } from './services/ai-actor.service';
import { AiInformesService } from './services/ai-informes.service';
import { AiAutomaticoService } from './services/ai-automatico.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [
    AuthModule,
    ConfigModule,
    NotificacionesModule,
    TypeOrmModule.forFeature([Usuario, Empleado, MetricaKpi, MetricaKpiDiaria, AiInforme]),
  ],

  controllers: [AiToolsController, AiToolsLegacyController, AiController],

  providers: [AiToolsAuthGuard, AiToolsService, AiContextService, AiService, AiActorService, AiInformesService, AiAutomaticoService],

  exports: [AiToolsService],
})
export class AiModule {}
