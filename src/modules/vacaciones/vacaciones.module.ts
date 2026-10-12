import { VacacionesSaldoService } from './vacaciones-saldo.service';
import { VacacionesGestionService } from './vacaciones-gestion.service';
import { VacacionesGestionController } from './vacaciones-gestion.controller';
import { VacacionesPeriodo } from './entities/vacaciones-periodo.entity';
import { VacacionesMovimiento } from './entities/vacaciones-movimiento.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolicitudIncidencia } from '../solicitudes/entities/solicitud-incidencia.entity';
import { Empleado } from '../organization/empleados/entities/empleado.entity';
import { VacacionesController } from './vacaciones.controller';
import { VacacionesService } from './vacaciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SolicitudIncidencia,
      Empleado,
      VacacionesPeriodo,
      VacacionesMovimiento,
    ]),
  ],
  controllers: [VacacionesController, VacacionesGestionController],
  providers: [
    VacacionesService,
    VacacionesSaldoService,
    VacacionesGestionService,
  ],
  exports: [VacacionesSaldoService],
})
export class VacacionesModule {}
