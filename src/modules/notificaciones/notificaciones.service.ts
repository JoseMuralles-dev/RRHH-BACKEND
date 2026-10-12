import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  DataSource,
  EntityManager,
} from 'typeorm';

import { Notificacion } from './entities/notificacion.entity';

import { Empleado } from '../organization/empleados/entities/empleado.entity';

// AJUSTA ESTA RUTA SI TU ENTIDAD USUARIO ESTÁ EN OTRA CARPETA
import { Usuario } from '../user/entities/user.entity';

export interface CrearNotificacionParams {
  idUsuarioDestinatario: number;

  tipo: string;

  titulo: string;

  mensaje: string;

  referenciaTipo?: string | null;

  referenciaId?: number | null;
}

@Injectable()
export class NotificacionesService {
  constructor(
    private readonly dataSource: DataSource,
  ) {}

  async crear(
    datos: CrearNotificacionParams,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<Notificacion> {

    const repo =
      manager.getRepository(Notificacion);

    const notificacion =
      repo.create({
        idUsuarioDestinatario:
          datos.idUsuarioDestinatario,

        tipo:
          datos.tipo,

        titulo:
          datos.titulo,

        mensaje:
          datos.mensaje,

        referenciaTipo:
          datos.referenciaTipo ?? null,

        referenciaId:
          datos.referenciaId ?? null,

        leida:
          false,

        fechaLectura:
          null,

        isActive:
          true,
      });

    return repo.save(notificacion);
  }

  async notificarNuevaSolicitud(
    manager: EntityManager,
    idEmpleadoSolicitante: number,
    idSolicitud: number,
  ): Promise<Notificacion | null> {

    const empleado =
      await manager
        .getRepository(Empleado)
        .findOne({
          where: {
            idEmpleado:
              idEmpleadoSolicitante,

            isActive:
              true,
          },
        });

    if (!empleado) {
      throw new NotFoundException(
        'No se encontró el empleado solicitante.',
      );
    }

    if (
      !empleado.idJefeDirecto
    ) {
      return null;
    }

    const jefe =
      await manager
        .getRepository(Empleado)
        .findOne({
          where: {
            idEmpleado:
              empleado.idJefeDirecto,

            isActive:
              true,
          },
        });

    if (!jefe) {
      return null;
    }

    const usuarioJefe =
      await manager
        .getRepository(Usuario)
        .findOne({
          where: {
            idEmpleado:
              jefe.idEmpleado,

            isActive:
              true,
          },
        });

    if (!usuarioJefe) {
      return null;
    }

    const nombreSolicitante =
      [
        empleado.primerNombre,
        empleado.segundoNombre,
        empleado.primerApellido,
        empleado.segundoApellido,
      ]
        .filter(Boolean)
        .join(' ');

    return this.crear(
      {
        idUsuarioDestinatario:
          usuarioJefe.idUsuario,

        tipo:
          'SOLICITUD_CREADA',

        titulo:
          'Nueva solicitud pendiente',

        mensaje:
          `${nombreSolicitante} realizó una nueva solicitud.`,

        referenciaTipo:
          'SOLICITUD_INCIDENCIA',

        referenciaId:
          idSolicitud,
      },
      manager,
    );
  }

  async notificarSolicitudAprobada(
    manager: EntityManager,
    idEmpleado: number,
    idSolicitud: number,
  ): Promise<Notificacion | null> {

    const usuario =
      await manager
        .getRepository(Usuario)
        .findOne({
          where: {
            idEmpleado,
            isActive: true,
          },
        });

    if (!usuario) {
      return null;
    }

    return this.crear(
      {
        idUsuarioDestinatario:
          usuario.idUsuario,

        tipo:
          'SOLICITUD_APROBADA',

        titulo:
          'Solicitud aprobada',

        mensaje:
          'Tu solicitud fue aprobada.',

        referenciaTipo:
          'SOLICITUD_INCIDENCIA',

        referenciaId:
          idSolicitud,
      },
      manager,
    );
  }

  async notificarSolicitudRechazada(
    manager: EntityManager,
    idEmpleado: number,
    idSolicitud: number,
  ): Promise<Notificacion | null> {

    const usuario =
      await manager
        .getRepository(Usuario)
        .findOne({
          where: {
            idEmpleado,
            isActive: true,
          },
        });

    if (!usuario) {
      return null;
    }

    return this.crear(
      {
        idUsuarioDestinatario:
          usuario.idUsuario,

        tipo:
          'SOLICITUD_RECHAZADA',

        titulo:
          'Solicitud rechazada',

        mensaje:
          'Tu solicitud fue rechazada.',

        referenciaTipo:
          'SOLICITUD_INCIDENCIA',

        referenciaId:
          idSolicitud,
      },
      manager,
    );
  }

  private validarUsuario(idUsuario: number): void {
    if (!Number.isSafeInteger(idUsuario) || idUsuario < 1) {
      throw new ForbiddenException('Usuario no valido.');
    }
  }

  async obtenerMias(idUsuario: number): Promise<Notificacion[]> {
    this.validarUsuario(idUsuario);
    return this.dataSource.getRepository(Notificacion).find({
      where: { idUsuarioDestinatario: idUsuario, isActive: true },
      order: { createdAt: 'DESC', idNotificacion: 'DESC' },
      take: 50,
    });
  }

  async contarNoLeidas(idUsuario: number) {
    this.validarUsuario(idUsuario);
    const noLeidas = await this.dataSource.getRepository(Notificacion).count({
      where: { idUsuarioDestinatario: idUsuario, leida: false, isActive: true },
    });
    return { noLeidas };
  }

  async marcarComoLeida(idNotificacion: number, idUsuario: number) {
    this.validarUsuario(idUsuario);
    if (!Number.isSafeInteger(idNotificacion) || idNotificacion < 1) {
      throw new NotFoundException('La notificacion no existe.');
    }
    const repo = this.dataSource.getRepository(Notificacion);
    const where = { idNotificacion, idUsuarioDestinatario: idUsuario, isActive: true };
    // La condicion evita sobrescribir la primera fecha de lectura entre peticiones.
    await repo.update({ ...where, leida: false }, { leida: true, fechaLectura: new Date() });
    const notificacion = await repo.findOne({ where });
    if (!notificacion) throw new NotFoundException('La notificacion no existe.');
    return notificacion;
  }

  async marcarTodasComoLeidas(idUsuario: number) {
    this.validarUsuario(idUsuario);
    const resultado = await this.dataSource.getRepository(Notificacion).update(
      { idUsuarioDestinatario: idUsuario, leida: false, isActive: true },
      { leida: true, fechaLectura: new Date() },
    );
    return { actualizadas: resultado.affected ?? 0 };
  }
}
