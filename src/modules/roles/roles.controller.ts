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

import { RolesService } from './roles.service';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRolDto } from './dto/update-rol.dto';

import { JwtAuthGuard } from '../../common/guards/jwt/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { MinLevel } from '../../common/decorators/min-level/min-level.decorator';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {

  constructor(
    private readonly rolesService: RolesService,
  ) {}

  @Post()
  @MinLevel(4)
  create(@Body() dto: CreateRolDto) {
    return this.rolesService.create(dto);
  }

  @Get()
  @MinLevel(3)
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @MinLevel(3)
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  @MinLevel(4)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRolDto,
  ) {
    return this.rolesService.update(id, dto);
  }

  @Patch(':id/desactivar')
  @MinLevel(4)
  desactivar(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.rolesService.desactivar(id);
  }
}