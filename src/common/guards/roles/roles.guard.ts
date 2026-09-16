import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException, // <-- 1. Importación corregida
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MIN_LEVEL_KEY } from '../../decorators/min-level/min-level.decorator';


@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 2. getAllAndOverride busca el metadata tanto en el Método como en la Clase
    const requiredLevel = this.reflector.getAllAndOverride<number>(
      MIN_LEVEL_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si el endpoint o controlador no exige un nivel mínimo, permite el acceso
    if (!requiredLevel) return true;

    // Extraemos el usuario que adjuntó el JwtStrategy en Request
    const { user } = context.switchToHttp().getRequest();

    if (!user || user.nivelJerarquico === undefined) {
      throw new ForbiddenException('No posee credenciales de rol válidas');
    }

    // Validación de Jerarquía (ej: 2 < 3 -> Bloqueado)
    if (user.nivelJerarquico < requiredLevel) {
      throw new ForbiddenException(
        'No tiene permisos suficientes para realizar esta acción',
      );
    }

    return true;
  }
}