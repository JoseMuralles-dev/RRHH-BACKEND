import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt/jwt-auth.guard';

import { NotificacionesService } from './notificaciones.service';

interface UsuarioNotificacion {
  idUsuario: number;
  idEmpleado?: number;
  correo?: string;
  nivelJerarquico?: number;
}

@Controller('notificaciones')
@UseGuards(JwtAuthGuard)
export class NotificacionesController {
  constructor(
    private readonly notificacionesService:
      NotificacionesService,
  ) {}

  @Get('mias')
  obtenerMias(
    @Req()
    req: {
      user: UsuarioNotificacion;
    },
  ) {
    return this.notificacionesService
      .obtenerMias(
        req.user.idUsuario,
      );
  }

  @Get('no-leidas/count')
  contarNoLeidas(
    @Req()
    req: {
      user: UsuarioNotificacion;
    },
  ) {
    return this.notificacionesService
      .contarNoLeidas(
        req.user.idUsuario,
      );
  }

  @Patch(':id/leida')
  marcarComoLeida(
    @Param(
      'id',
      ParseIntPipe,
    )
    idNotificacion: number,

    @Req()
    req: {
      user: UsuarioNotificacion;
    },
  ) {
    return this.notificacionesService
      .marcarComoLeida(
        idNotificacion,
        req.user.idUsuario,
      );
  }

  @Patch('marcar-todas/leidas')
  marcarTodasComoLeidas(
    @Req()
    req: {
      user: UsuarioNotificacion;
    },
  ) {
    return this.notificacionesService
      .marcarTodasComoLeidas(
        req.user.idUsuario,
      );
  }
}