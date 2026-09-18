import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';
import { SolicitudIncidencia } from './entities/solicitud-incidencia.entity';
import { TipoIncidencia } from './entities/tipo-incidencia.entity';
import { AprobacionIncidencia } from './entities/aprobacion-incidencia.entity';
import { Empleado } from '../organization/empleados/entities/empleado.entity';
import { Usuario } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SolicitudIncidencia,
      TipoIncidencia,
      AprobacionIncidencia,
      Empleado,
      Usuario,
    ]),
  ],

  controllers: [
    SolicitudesController,
  ],

  providers: [
    SolicitudesService,
  ],
})
export class SolicitudesModule {}