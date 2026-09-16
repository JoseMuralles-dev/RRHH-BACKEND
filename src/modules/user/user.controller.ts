import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { MinLevel } from '../../common/decorators/min-level/min-level.decorator';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt/jwt-auth.guard';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UsuariosService } from './user.service';

@Controller('user')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {

  constructor(
    private readonly usuariosService: UsuariosService,
  ) {}

  @Post()
  @MinLevel(4)
  crearUser(
    @Body() dto: CreateUsuarioDto,
  ) {
    return this.usuariosService.create(dto);
  }
}