import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Empleado } from '../organization/empleados/entities/empleado.entity';
import { KpiController } from './kpi.controller';
import { KpiService } from './service/kpi.service';

@Module({
  imports: [TypeOrmModule.forFeature([Empleado])],
  controllers: [KpiController],
  providers: [KpiService],
  exports: [KpiService],
})
export class KpiModule {}
