import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../../common/guards/jwt/jwt-auth.guard';
import { Usuario } from '../../user/entities/user.entity';
import { EstadoUsuario } from '../../user/estado-usuario.enum';
import type { Request } from 'express';

@Injectable()
export class AiToolsAuthGuard extends JwtAuthGuard {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) { super(); }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = req.headers['x-internal-token'];
    const actor = req.headers['x-actor-id'];
    // Without internal headers, preserve the existing JWT authentication.
    if (token === undefined && actor === undefined) {
      return super.canActivate(context) as Promise<boolean>;
    }
    const expected = this.config.get<string>('N8N_INTERNAL_TOKEN');
    if (!expected || typeof token !== 'string' || !token ||
        !timingSafeEqual(createHash('sha256').update(token).digest(),
          createHash('sha256').update(expected).digest())) {
      throw new UnauthorizedException('Credenciales internas invalidas');
    }
    if (typeof actor !== 'string' || !/^[1-9]\d*$/.test(actor) ||
        !Number.isSafeInteger(Number(actor)) || Number(actor) > 2147483647) {
      throw new UnauthorizedException('Actor interno invalido');
    }
    const usuario = await this.usuarios.findOne({
      where: { idUsuario: Number(actor), isActive: true, estado: EstadoUsuario.ACTIVO },
      relations: { rol: true },
    });
    const nivel = usuario?.rol?.nivelJerarquico;
    if (!usuario || !usuario.isActive || usuario.estado !== EstadoUsuario.ACTIVO ||
        !usuario.rol?.isActive || !nivel || ![1, 2, 3, 4].includes(nivel)) {
      throw new UnauthorizedException('Actor interno no autorizado');
    }
    req.user = {
      idUsuario: usuario.idUsuario,
      idEmpleado: usuario.idEmpleado ?? null,
      nivelJerarquico: nivel,
    };
    return true;
  }
}
