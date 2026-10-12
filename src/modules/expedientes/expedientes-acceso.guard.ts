import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ExpedientesService } from './services/expedientes.service';

@Injectable()
export class ExpedientesAccesoGuard implements CanActivate {
  constructor(private readonly expedientes: ExpedientesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const usuario = req.user;
    const nivel = usuario?.nivelJerarquico;
    if (![1, 2, 3, 4].includes(nivel)) throw new ForbiddenException('Sin acceso a expedientes');
    if (nivel === 3 || nivel === 4) return true;
    // Los guards se ejecutan antes del interceptor que guarda el archivo subido.
    if (req.method !== 'GET') throw new ForbiddenException('Tu expediente es de solo lectura');
    await this.expedientes.autorizarLecturaPropia(
      usuario.idEmpleado,
      req.params.idEmpleado,
      req.params.idExpediente,
    );
    return true;
  }
}
