import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Puesto } from './entities/puesto.entity';
import { Departamento } from '../departamentos/entities/departamento.entity';
import { PuestosController } from './puestos.controller';
import { PuestosService } from './puestos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Puesto,
      Departamento,
    ]),
  ],
  controllers: [
    PuestosController,
  ],
  providers: [
    PuestosService,
  ],
  exports: [
    PuestosService,
  ],
})
export class PuestosModule {}
