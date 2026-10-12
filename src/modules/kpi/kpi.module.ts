import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Empleado } from '../organization/empleados/entities/empleado.entity';
import { KpiController } from './kpi.controller';
import { KpiService } from './service/kpi.service';
import { CincoSController } from './cinco-s/cinco-s.controller';
import { CincoSService } from './cinco-s/cinco-s.service';

@Module({
  imports: [TypeOrmModule.forFeature([Empleado])],
  controllers: [KpiController, CincoSController],
  providers: [KpiService, CincoSService],
  exports: [KpiService],
})
export class KpiModule {}
