import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { EmpleadosService } from './empleados.service';
import { CreateEmpleadoDto } from './dto/create-empleado.dto';
import { UpdateEmpleadoDto } from './dto/update-empleado.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles/roles.guard';
import { MinLevel } from '../../../common/decorators/min-level/min-level.decorator';

@Controller('empleados')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmpleadosController {
  constructor(private readonly empleadosService: EmpleadosService) {}

  // ============================================================
  // CREAR EMPLEADO
  // ============================================================

  @Post()
  @MinLevel(3)
  create(@Body() dto: CreateEmpleadoDto) {
    return this.empleadosService.create(dto);
  }

  // ============================================================
  // LISTAR EMPLEADOS
  // ============================================================

  @Get()
  @MinLevel(2)
  findAll() {
    return this.empleadosService.findAll();
  }

  // ============================================================
  // SELECT DE EMPLEADOS
  // ============================================================

  @Get('select')
  @MinLevel(2)
  findForSelect() {
    return this.empleadosService.findForSelect();
  }

  // ============================================================
  // BUSCAR
  // ============================================================

  @Get('buscar')
  @MinLevel(2)
  buscar(@Query('texto') texto: string) {
    return this.empleadosService.buscar(texto);
  }

  // ============================================================
  // BUSCAR POR ID
  // ============================================================

  @Get(':id')
  @MinLevel(2)
  findOne(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.empleadosService.findOne(id);
  }

  // ============================================================
  // ACTUALIZAR
  // ============================================================

  @Patch(':id')
  @MinLevel(3)
  update(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    dto: UpdateEmpleadoDto,
  ) {
    return this.empleadosService.update(id, dto);
  }

  // ============================================================
  // DESACTIVAR
  // ============================================================

  @Patch(':id/desactivar')
  @MinLevel(3)
  desactivar(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.empleadosService.desactivar(id);
  }
}
