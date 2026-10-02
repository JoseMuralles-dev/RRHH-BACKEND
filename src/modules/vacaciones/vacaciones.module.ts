import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolicitudIncidencia } from '../solicitudes/entities/solicitud-incidencia.entity';
import { Empleado } from '../organization/empleados/entities/empleado.entity';
import { VacacionesController } from './vacaciones.controller';
import { VacacionesService } from './vacaciones.service';

@Module({
  imports: [TypeOrmModule.forFeature([SolicitudIncidencia, Empleado])],
  controllers: [VacacionesController],
  providers: [VacacionesService],
})
export class VacacionesModule {}
