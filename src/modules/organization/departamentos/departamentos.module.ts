import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Departamento } from './entities/departamento.entity';
import { DepartamentosController } from './departamento.controller';
import { DepartamentosService } from './departamento.service';

@Module({
  imports: [TypeOrmModule.forFeature([Departamento])],
  controllers: [DepartamentosController],
  providers: [DepartamentosService],
})
export class DepartamentosModule {}
