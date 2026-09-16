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

import { PuestosService }
  from './puestos.service';

import { CreatePuestoDto }
  from './dto/create-puesto.dto';

import { UpdatePuestoDto }
  from './dto/update-puesto.dto';

import { JwtAuthGuard }
  from '../../../common/guards/jwt/jwt-auth.guard';

import { RolesGuard }
  from '../../../common/guards/roles/roles.guard';

import { MinLevel }
  from '../../../common/decorators/min-level/min-level.decorator';

@Controller('puestos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PuestosController {

  constructor(
    private readonly puestosService:
      PuestosService,
  ) {}

  @Post()
  @MinLevel(4)
  create(@Body() dto: CreatePuestoDto) {
    return this.puestosService.create(dto);
  }

  @Get()
  @MinLevel(2)
  findAll() {
    return this.puestosService.findAll();
  }

  @Get(':id')
  @MinLevel(2)
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.puestosService.findOne(id);
  }

  @Patch(':id')
  @MinLevel(4)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePuestoDto,
  ) {
    return this.puestosService.update(id, dto);
  }

  @Patch(':id/desactivar')
  @MinLevel(4)
  desactivar(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.puestosService.desactivar(id);
  }
}