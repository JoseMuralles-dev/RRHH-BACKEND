import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Empleado } from './entities/empleado.entity';
import { Puesto } from '../puestos/entities/puesto.entity';
import { EmpleadosController } from './empleados.controller';
import { EmpleadosService } from './empleados.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Empleado,
      Puesto,
    ]),
  ],
  controllers: [
    EmpleadosController,
  ],
  providers: [
    EmpleadosService,
  ],
  exports: [
    EmpleadosService,
  ],
})
export class EmpleadosModule {}
