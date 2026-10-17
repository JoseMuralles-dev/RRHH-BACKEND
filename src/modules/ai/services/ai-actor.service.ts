import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import { Usuario } from '../../user/entities/user.entity';
import { EstadoUsuario } from '../../user/estado-usuario.enum';
import { AiContextService } from './ai-context.service';
import type { UsuarioAnalitico } from '../interfaces/ai-context.interface';

@Injectable()
export class AiActorService {
  constructor(@InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly contexto: AiContextService) {}

  async obtener(idUsuario: number): Promise<UsuarioAnalitico> {
    if (!Number.isSafeInteger(idUsuario) || idUsuario < 1) throw new ForbiddenException('Usuario inválido');
    const usuario = await this.usuarios.findOne({
      where: { idUsuario, isActive: true, estado: EstadoUsuario.ACTIVO }, relations: { rol: true },
    });
    const nivel = usuario?.rol?.nivelJerarquico;
    if (!usuario?.rol?.isActive || !nivel || ![1, 2, 3, 4].includes(nivel)) {
      throw new ForbiddenException('Usuario o rol inactivo');
    }
    return { idUsuario, idEmpleado: usuario.idEmpleado ?? null, nivelJerarquico: nivel };
  }

  // Si cambian permisos o miembros del equipo, el historial anterior ya no se muestra.
  async alcance(actor: UsuarioAnalitico): Promise<string> {
    let empleados: number[] = [];
    if (actor.nivelJerarquico === 1) {
      const empleado = await this.contexto.autorizarEmpleado(actor, actor.idEmpleado!);
      empleados = [empleado.idEmpleado];
    } else if (actor.nivelJerarquico === 2) {
      empleados = (await this.contexto.autorizarEquipo(actor, actor.idEmpleado!)).map(e => e.idEmpleado).sort((a,b) => a-b);
    }
    return createHash('sha256').update(JSON.stringify({ ...actor, empleados })).digest('hex');
  }
}
