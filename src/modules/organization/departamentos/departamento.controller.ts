import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { DepartamentosService }
  from './departamento.service';

import { CreateDepartamentoDto }
  from './dto/create-departamento.dto';

import { UpdateDepartamentoDto }
  from './dto/update-departamento.dto';

import { JwtAuthGuard }
  from '../../../common/guards/jwt/jwt-auth.guard';

import { RolesGuard }
  from '../../../common/guards/roles/roles.guard';

import { MinLevel }
  from '../../../common/decorators/min-level/min-level.decorator';

@Controller('departamentos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartamentosController {

  constructor(
    private readonly departamentosService:
      DepartamentosService,
  ) {}

  @Post()
  @MinLevel(4)
  create(
    @Body() dto: CreateDepartamentoDto,
  ) {
    return this.departamentosService.create(dto);
  }

  @Get()
  @MinLevel(3)
  findAll() {
    return this.departamentosService.findAll();
  }

  @Get(':id')
  @MinLevel(3)
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.departamentosService.findOne(id);
  }

  @Patch(':id')
  @MinLevel(4)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDepartamentoDto,
  ) {
    return this.departamentosService.update(
      id,
      dto,
    );
  }

  @Patch(':id/desactivar')
  @MinLevel(4)
  desactivar(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.departamentosService.desactivar(
      id,
    );
  }
}