import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'secreto_default',
    });
  }

  async validate(payload: any) {
    // Retorna los datos requeridos por la request (req.user)
    return {
      idUsuario: payload.sub,
      correo: payload.correo,
      idEmpleado: payload.idEmpleado,
      idRol: payload.idRol,
      nivelJerarquico: payload.nivelJerarquico,
    };
  }
}