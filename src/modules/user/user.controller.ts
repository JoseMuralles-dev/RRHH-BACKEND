import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { MinLevel } from '../../common/decorators/min-level/min-level.decorator';
import { Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt/jwt-auth.guard';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UsuariosService } from './user.service';

@Controller('user')
@UseGuards(JwtAuthGuard, RolesGuard)
@MinLevel(4)
export class UserController {
  @Get()
  findAll() {
    return this.usuariosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.findOne(id, true);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUsuarioDto) {
    return this.usuariosService.update(id, dto);
  }

  @Patch(':id/password')
  changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usuariosService.changePassword(id, dto);
  }

  @Patch(':id/desactivar')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.remove(id);
  }

  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @MinLevel(4)
  crearUser(@Body() dto: CreateUsuarioDto) {
    return this.usuariosService.create(dto);
  }
}
