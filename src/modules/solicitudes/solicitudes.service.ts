import { VacacionesSaldoService } from '../vacaciones/vacaciones-saldo.service';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { SolicitudIncidencia } from './entities/solicitud-incidencia.entity';
import { TipoIncidencia } from './entities/tipo-incidencia.entity';
import { AprobacionIncidencia } from './entities/aprobacion-incidencia.entity';
import { Empleado } from '../organization/empleados/entities/empleado.entity';
import { Usuario } from '../user/entities/user.entity';
import { EstadoUsuario } from '../user/estado-usuario.enum';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { ResolverAprobacionDto } from './dto/resolver-aprobacion.dto';
import { EstadoSolicitud } from './enums/estado-solicitud.enum';
import { EstadoAprobacion } from './enums/estado-aprobacion.enum';
import { aprobacionDisponible, ESTADOS_ABIERTOS, validarPeriodo,  ESTADOS_APROBADA } from './solicitud-reglas';
import {NotificacionesService,} from '../notificaciones/notificaciones.service';

@Injectable()
export class SolicitudesService {

  constructor(

    @InjectRepository(SolicitudIncidencia)
    private readonly solicitudRepository:
      Repository<SolicitudIncidencia>,

    @InjectRepository(TipoIncidencia)
    private readonly tipoRepository:
      Repository<TipoIncidencia>,

    @InjectRepository(AprobacionIncidencia)
    private readonly aprobacionRepository:
      Repository<AprobacionIncidencia>,

    @InjectRepository(Empleado)
    private readonly empleadoRepository:
      Repository<Empleado>,

    @InjectRepository(Usuario)
    private readonly usuarioRepository:
      Repository<Usuario>,

    private readonly dataSource:
      DataSource,

    private readonly vacaciones:
      VacacionesSaldoService,

    private readonly notificacionesService:
      NotificacionesService,
  ) {}

  // =========================================================
  // CREAR SOLICITUD
  // =========================================================

  async create(
    idEmpleado: number | null,
    dto: CreateSolicitudDto,
  ) {

    if (!idEmpleado) {
      throw new BadRequestException(
        'El usuario autenticado no está asociado a un empleado',
      );
    }

    if (!dto.motivo?.trim()) {
      throw new BadRequestException(
        'Debe indicar el motivo de la solicitud',
      );
    }

    return this.dataSource.transaction(
      'READ COMMITTED',
      async manager => {

        await this.vacaciones.bloquearEmpleado(
          manager,
          idEmpleado,
        );

        const empleado =
          await manager
            .getRepository(Empleado)
            .findOne({
              where: {
                idEmpleado,
                isActive: true,
              },

              relations: {
                jefeDirecto: {
                  usuario: {
                    rol: true,
                  },
                },
              },
            });

        if (!empleado) {
          throw new NotFoundException(
            'Empleado no encontrado',
          );
        }

        const tipo =
          await manager
            .getRepository(TipoIncidencia)
            .findOne({
              where: {
                idTipoIncidencia:
                  dto.idTipoIncidencia,

                isActive:
                  true,
              },
            });

        if (!tipo) {
          throw new NotFoundException(
            'El tipo de incidencia no existe o está inactivo',
          );
        }

        let diasSolicitados:
          number | null = null;

        // =====================================================
        // VALIDACIÓN DEL PERÍODO
        // =====================================================

        if (tipo.requierePeriodo) {

          if (
            dto.fechaInicio == null ||
            dto.fechaFin == null ||
            dto.diasSolicitados == null
          ) {
            throw new BadRequestException(
              'Este tipo de solicitud requiere fechas y días laborables',
            );
          }

          diasSolicitados =
            validarPeriodo(
              dto.fechaInicio,
              dto.fechaFin,
              dto.diasSolicitados,
            );

        } else if (
          dto.fechaInicio != null ||
          dto.fechaFin != null ||
          dto.diasSolicitados != null
        ) {

          throw new BadRequestException(
            'Este tipo de solicitud no admite fechas ni días laborables',
          );
        }

        // =====================================================
        // VALIDACIÓN DE VACACIONES
        // =====================================================

        if (tipo.descuentaVacaciones) {

          if (!tipo.requierePeriodo) {
            throw new BadRequestException(
              'El catálogo de vacaciones debe requerir período',
            );
          }

          await this.vacaciones
            .validarDisponibilidad(
              manager,
              idEmpleado,
              {
                idSolicitud: 0,

                fechaInicio:
                  dto.fechaInicio!,

                fechaFin:
                  dto.fechaFin!,

                diasSolicitados,
              },
            );
        }

        // =====================================================
        // JEFE DIRECTO
        // =====================================================

        const jefe =
          empleado.jefeDirecto;

        const usuarioJefe =
          jefe?.usuario;

        if (
          !jefe?.isActive ||
          jefe.idEmpleado === idEmpleado ||
          !usuarioJefe?.isActive ||
          usuarioJefe.estado !== EstadoUsuario.ACTIVO ||
          !usuarioJefe.rol?.isActive
        ) {

          throw new BadRequestException(
            'Debe asignar un jefe directo distinto al solicitante, con empleado, usuario y rol activos',
          );
        }

        // =====================================================
        // APROBADORES
        // =====================================================

        const aprobadores =
          usuarioJefe.rol.codigoRol === 'RRHH'
            ? [
                usuarioJefe,
              ]
            : [
                usuarioJefe,

                await this.obtenerUsuarioRRHH(
                  manager,
                  idEmpleado,
                  usuarioJefe.idUsuario,
                ),
              ];

        const solicitudRepo =
          manager.getRepository(
            SolicitudIncidencia,
          );

        const aprobacionRepo =
          manager.getRepository(
            AprobacionIncidencia,
          );

        // =====================================================
        // GUARDAR SOLICITUD
        // =====================================================

        const solicitud =
          await solicitudRepo.save(
            solicitudRepo.create({

              idEmpleado,

              idTipoIncidencia:
                dto.idTipoIncidencia,

              fechaInicio:
                tipo.requierePeriodo
                  ? dto.fechaInicio!
                  : null,

              fechaFin:
                tipo.requierePeriodo
                  ? dto.fechaFin!
                  : null,

              diasSolicitados,

              motivo:
                dto.motivo.trim(),

              estado:
                EstadoSolicitud.PENDIENTE,

              isActive:
                true,
            }),
          );

        // =====================================================
        // CREAR NIVELES DE APROBACIÓN
        // =====================================================

        await aprobacionRepo.save(
          aprobadores.map(
            (usuario, index) =>
              aprobacionRepo.create({

                idSolicitud:
                  solicitud.idSolicitud,

                idUsuarioAprobador:
                  usuario.idUsuario,

                nivelAprobacion:
                  index + 1,

                estado:
                  EstadoAprobacion.PENDIENTE,
              }),
          ),
        );

        // =====================================================
        // NOTIFICAR AL PRIMER APROBADOR
        // =====================================================

        await this.notificacionesService
          .notificarNuevaSolicitud(
            manager,
            solicitud.idEmpleado,
            solicitud.idSolicitud,
          );

        // IMPORTANTE:
        // El return debe estar después de la notificación.
        return solicitud;
      },
    );
  }

  // =========================================================
  // TIPOS DE INCIDENCIA
  // =========================================================

  findTiposIncidencia() {

    return this.tipoRepository.find({

      where: {
        isActive: true,
      },

      order: {
        nombre: 'ASC',
      },

      select: {
        idTipoIncidencia: true,
        nombre: true,
        requierePeriodo: true,
        esRemunerado: true,
        descuentaVacaciones: true,
      },
    });
  }

  // =========================================================
  // MIS SOLICITUDES
  // =========================================================

  findMisSolicitudes(
    idEmpleado: number | null,
  ) {

    if (!idEmpleado) {
      throw new BadRequestException(
        'Usuario sin empleado asociado',
      );
    }

    return this.solicitudRepository.find({

      where: {
        idEmpleado,
        isActive: true,
      },

      relations: {
        tipoIncidencia: true,

        aprobaciones: {
          usuarioAprobador: true,
        },
      },

      order: {
        createdAt: 'DESC',
      },
    });
  }

  // =========================================================
  // SOLICITUDES PENDIENTES DE APROBACIÓN
  // =========================================================

  async findPendientesAprobacion(
    idUsuario: number,
  ) {

    await this.validarAprobador(
      this.usuarioRepository,
      idUsuario,
    );

    const pendientes =
      await this.aprobacionRepository.find({

        where: {

          idUsuarioAprobador:
            idUsuario,

          estado:
            EstadoAprobacion.PENDIENTE,

          solicitud: {

            isActive:
              true,

            estado:
              In(ESTADOS_ABIERTOS),
          },
        },

        relations: {

          solicitud: {

            empleado:
              true,

            tipoIncidencia:
              true,

            aprobaciones:
              true,
          },
        },

        order: {
          createdAt: 'ASC',
        },
      });

    return pendientes.filter(
      aprobacion =>

        aprobacionDisponible(
          aprobacion.solicitud.aprobaciones ?? [],
        )?.idAprobacion ===
        aprobacion.idAprobacion,
    );
  }

  // =========================================================
  // SOLICITUDES APROBADAS
  // =========================================================

  async findAprobadas(
    idUsuario: number,
  ) {

    await this.validarAprobador(
      this.usuarioRepository,
      idUsuario,
    );

    const aprobadas =
      await this.aprobacionRepository.find({

        where: {

          idUsuarioAprobador:
            idUsuario,

          estado:
            EstadoAprobacion.APROBADA,

          solicitud: {

            isActive:
              true,

            estado:
              In(ESTADOS_APROBADA),
          },
        },

        relations: {

          solicitud: {

            empleado:
              true,

            tipoIncidencia:
              true,

            aprobaciones:
              true,
          },
        },

        order: {
          createdAt: 'ASC',
        },
      });

    return aprobadas.filter(
      aprobacion =>
        aprobacion.solicitud.estado ===
        EstadoSolicitud.APROBADA,
    );
  }

  // =========================================================
  // BUSCAR SOLICITUD
  // =========================================================

  async findOne(
    idSolicitud: number,

    usuario: {
      idUsuario: number;
      idEmpleado?: number | null;
      nivelJerarquico: number;
    },
  ) {

    const solicitud =
      await this.solicitudRepository.findOne({

        where: {
          idSolicitud,
          isActive: true,
        },

        relations: {

          empleado:
            true,

          tipoIncidencia:
            true,

          aprobaciones: {
            usuarioAprobador:
              true,
          },
        },
      });

    if (!solicitud) {
      throw new NotFoundException(
        'Solicitud no encontrada',
      );
    }

    if (
      solicitud.idEmpleado !==
        usuario.idEmpleado &&

      usuario.nivelJerarquico < 3 &&

      !solicitud.aprobaciones?.some(
        aprobacion =>
          aprobacion.idUsuarioAprobador ===
          usuario.idUsuario,
      )
    ) {

      throw new ForbiddenException(
        'No tiene permiso para visualizar esta solicitud',
      );
    }

    return solicitud;
  }

  // =========================================================
  // APROBAR
  // =========================================================

  aprobar(
    idSolicitud: number,
    idUsuario: number,
    dto: ResolverAprobacionDto,
  ) {

    return this.resolver(
      idSolicitud,
      idUsuario,
      dto,
      EstadoAprobacion.APROBADA,
    );
  }

  // =========================================================
  // RECHAZAR
  // =========================================================

  async rechazar(
    idSolicitud: number,
    idUsuario: number,
    dto: ResolverAprobacionDto,
  ) {

    if (!dto.comentario?.trim()) {

      throw new BadRequestException(
        'Debe indicar el motivo del rechazo',
      );
    }

    return this.resolver(
      idSolicitud,
      idUsuario,
      dto,
      EstadoAprobacion.RECHAZADA,
    );
  }

  // =========================================================
  // RESOLVER APROBACIÓN
  // =========================================================

  private resolver(
    idSolicitud: number,
    idUsuario: number,
    dto: ResolverAprobacionDto,
    estado: EstadoAprobacion,
  ) {

    return this.dataSource.transaction(
      'READ COMMITTED',
      async manager => {

        // Orden de bloqueo:
        // empleado → solicitud → movimientos.

        const solicitud =
          await this.solicitudAbiertaBloqueada(
            manager,
            idSolicitud,
          );

        const actor =
          await this.validarAprobador(
            manager.getRepository(Usuario),
            idUsuario,
          );

        if (
          actor.idEmpleado ===
          solicitud.idEmpleado
        ) {

          throw new ForbiddenException(
            'No puede resolver su propia solicitud',
          );
        }

        const aprobacionRepo =
          manager.getRepository(
            AprobacionIncidencia,
          );

        // =====================================================
        // APROBACIONES ACTUALES
        // =====================================================

        const aprobaciones =
          await aprobacionRepo.find({

            where: {
              idSolicitud,
            },

            order: {
              nivelAprobacion: 'ASC',
            },
          });

        const aprobacion =
          aprobacionDisponible(
            aprobaciones,
          );

        if (
          !aprobacion ||
          aprobacion.idUsuarioAprobador !==
            idUsuario
        ) {

          throw new ForbiddenException(
            'No tiene una aprobación disponible en el nivel actual de esta solicitud',
          );
        }

        // =====================================================
        // GUARDAR RESPUESTA
        // =====================================================

        aprobacion.estado =
          estado;

        aprobacion.comentario =
          dto.comentario?.trim() ||
          null;

        aprobacion.fechaRespuesta =
          new Date();

        await aprobacionRepo.save(
          aprobacion,
        );

        // =====================================================
        // VOLVER A CONSULTAR APROBACIONES
        // =====================================================

        const aprobacionesActualizadas =
          await aprobacionRepo.find({

            where: {
              idSolicitud,
            },

            order: {
              nivelAprobacion:
                'ASC',
            },
          });

        // =====================================================
        // RECHAZADA
        // =====================================================

        if (
          estado ===
          EstadoAprobacion.RECHAZADA
        ) {

          solicitud.estado =
            EstadoSolicitud.RECHAZADA;

          solicitud.fechaResolucion =
            new Date();

          await this.notificacionesService
            .notificarSolicitudRechazada(
              manager,
              solicitud.idEmpleado,
              solicitud.idSolicitud,
            );
        }

        // =====================================================
        // TODAS APROBADAS
        // =====================================================

        else if (
          aprobacionesActualizadas.every(
            item =>
              item.estado ===
              EstadoAprobacion.APROBADA,
          )
        ) {

          if (
            solicitud.tipoIncidencia
              .descuentaVacaciones
          ) {

            await this.vacaciones.consumir(
              manager,
              solicitud,
              actor,
            );
          }

          solicitud.estado =
            EstadoSolicitud.APROBADA;

          solicitud.fechaResolucion =
            new Date();

          await this.notificacionesService
            .notificarSolicitudAprobada(
              manager,
              solicitud.idEmpleado,
              solicitud.idSolicitud,
            );
        }

        // =====================================================
        // FALTA OTRO NIVEL
        // =====================================================

        else {

          solicitud.estado =
            EstadoSolicitud.EN_REVISION;

          const siguienteAprobacion =
            aprobacionDisponible(
              aprobacionesActualizadas,
            );

          if (siguienteAprobacion) {

            await this.notificacionesService
              .crear(
                {
                  idUsuarioDestinatario:
                    siguienteAprobacion
                      .idUsuarioAprobador,

                  /*
                   * Usamos SOLICITUD_CREADA
                   * para no requerir por ahora
                   * un tipo adicional en el
                   * CHECK de MySQL.
                   */
                  tipo:
                    'SOLICITUD_CREADA',

                  titulo:
                    'Solicitud pendiente de aprobación',

                  mensaje:
                    'Tiene una solicitud pendiente de revisión.',

                  referenciaTipo:
                    'SOLICITUD_INCIDENCIA',

                  referenciaId:
                    solicitud.idSolicitud,
                },

                manager,
              );
          }
        }

        // =====================================================
        // GUARDAR SOLICITUD
        // =====================================================

        return manager
          .getRepository(
            SolicitudIncidencia,
          )
          .save(solicitud);
      },
    );
  }

  // =========================================================
  // CANCELAR
  // =========================================================

  cancelar(
    idSolicitud: number,

    usuario: {
      idUsuario?: number;
      idEmpleado?: number | null;
      nivelJerarquico: number;
    },
  ) {

    return this.dataSource.transaction(
      'READ COMMITTED',
      async manager => {

        const solicitud =
          await this.solicitudAbiertaBloqueada(
            manager,
            idSolicitud,
            true,
          );

        if (
          solicitud.idEmpleado !==
            usuario.idEmpleado &&

          usuario.nivelJerarquico < 4
        ) {

          throw new ForbiddenException(
            'No tiene permiso para cancelar esta solicitud',
          );
        }

        if (
          solicitud.tipoIncidencia
            .descuentaVacaciones
        ) {

          const actor =
            await this.vacaciones.actor(
              manager,
              usuario.idUsuario!,
            );

          if (
            actor.idEmpleado !==
              solicitud.idEmpleado &&

            (actor.rol.nivelJerarquico ?? 0) < 4
          ) {

            throw new ForbiddenException(
              'Sin permiso para cancelar',
            );
          }

          if (
            solicitud.estado ===
            EstadoSolicitud.APROBADA
          ) {

            await this.vacaciones.devolver(
              manager,
              solicitud,
              actor,
            );
          }
        }

        solicitud.estado =
          EstadoSolicitud.CANCELADA;

        solicitud.fechaResolucion =
          new Date();

        return manager
          .getRepository(
            SolicitudIncidencia,
          )
          .save(solicitud);
      },
    );
  }

  // =========================================================
  // SOLICITUD ABIERTA Y BLOQUEADA
  // =========================================================

  private async solicitudAbiertaBloqueada(
    manager: EntityManager,
    idSolicitud: number,
    permitirAprobada = false,
  ) {

    const repo =
      manager.getRepository(
        SolicitudIncidencia,
      );

    const referencia =
      await repo.findOne({

        where: {
          idSolicitud,
          isActive: true,
        },
      });

    if (!referencia) {

      throw new NotFoundException(
        'Solicitud no encontrada',
      );
    }

    await this.vacaciones
      .bloquearEmpleado(
        manager,
        referencia.idEmpleado,
      );

    const solicitud =
      await repo.findOne({

        where: {
          idSolicitud,
          isActive: true,
        },

        lock: {
          mode: 'pessimistic_write',
        },
      });

    if (
      !solicitud ||
      solicitud.idEmpleado !==
        referencia.idEmpleado
    ) {

      throw new NotFoundException(
        'Solicitud no encontrada',
      );
    }

    const tipo =
      await manager
        .getRepository(TipoIncidencia)
        .findOneBy({

          idTipoIncidencia:
            solicitud.idTipoIncidencia,
        });

    if (!tipo) {

      throw new BadRequestException(
        'Tipo de incidencia no encontrado',
      );
    }

    solicitud.tipoIncidencia =
      tipo;

    if (
      !ESTADOS_ABIERTOS.includes(
        solicitud.estado,
      ) &&

      !(
        permitirAprobada &&
        tipo.descuentaVacaciones &&
        solicitud.estado ===
          EstadoSolicitud.APROBADA
      )
    ) {

      throw new BadRequestException(
        'La solicitud ya fue resuelta',
      );
    }

    return solicitud;
  }

  // =========================================================
  // EDITAR
  // =========================================================

  editar(
    idSolicitud: number,
    idUsuario: number,
    dto: CreateSolicitudDto,
  ) {

    return this.dataSource.transaction(
      'READ COMMITTED',
      async manager => {

        const solicitud =
          await this.solicitudAbiertaBloqueada(
            manager,
            idSolicitud,
          );

        const actor =
          await this.vacaciones.actor(
            manager,
            idUsuario,
          );

        if (
          solicitud.idEmpleado !==
          actor.idEmpleado
        ) {

          throw new ForbiddenException(
            'Solo el propietario puede editar',
          );
        }

        const empleadoActivo =
          await manager
            .getRepository(Empleado)
            .existsBy({

              idEmpleado:
                actor.idEmpleado,

              isActive:
                true,
            });

        if (!empleadoActivo) {

          throw new ForbiddenException(
            'Empleado inactivo',
          );
        }

        if (
          !solicitud.tipoIncidencia
            .descuentaVacaciones ||

          solicitud.estado !==
            EstadoSolicitud.PENDIENTE
        ) {

          throw new BadRequestException(
            'Solo se pueden editar vacaciones pendientes',
          );
        }

        if (
          dto.idTipoIncidencia !==
          solicitud.idTipoIncidencia
        ) {

          throw new BadRequestException(
            'No se puede cambiar el tipo de incidencia',
          );
        }

        const aprobaciones =
          await manager
            .getRepository(
              AprobacionIncidencia,
            )
            .find({

              where: {
                idSolicitud,
              },
            });

        if (
          aprobaciones.some(
            aprobacion =>
              aprobacion.estado !==
              EstadoAprobacion.PENDIENTE,
          )
        ) {

          throw new BadRequestException(
            'La solicitud ya inició su aprobación',
          );
        }

        if (
          !dto.fechaInicio ||
          !dto.fechaFin ||
          !dto.motivo?.trim()
        ) {

          throw new BadRequestException(
            'Indique fechas y motivo',
          );
        }

        const diasSolicitados =
          validarPeriodo(
            dto.fechaInicio,
            dto.fechaFin,
            dto.diasSolicitados!,
          );

        const candidata = {

          ...solicitud,

          fechaInicio:
            dto.fechaInicio,

          fechaFin:
            dto.fechaFin,

          diasSolicitados,

          motivo:
            dto.motivo.trim(),
        };

        await this.vacaciones
          .validarDisponibilidad(
            manager,
            solicitud.idEmpleado,
            candidata,
          );

        return manager
          .getRepository(
            SolicitudIncidencia,
          )
          .save(candidata);
      },
    );
  }

  // =========================================================
  // VALIDAR APROBADOR
  // =========================================================

  private async validarAprobador(
    repo: Repository<Usuario>,
    idUsuario: number,
  ) {

    const usuario =
      await repo.findOne({

        where: {

          idUsuario,

          isActive:
            true,

          estado:
            EstadoUsuario.ACTIVO,

          rol: {
            isActive:
              true,
          },
        },
      });

    if (!usuario) {

      throw new ForbiddenException(
        'El usuario aprobador no está activo',
      );
    }

    return usuario;
  }

  // =========================================================
  // OBTENER USUARIO RRHH
  // =========================================================

  private async obtenerUsuarioRRHH(
    manager: EntityManager,
    idEmpleado: number,
    idUsuarioJefe: number,
  ) {

    const candidatos =
      await manager
        .getRepository(Usuario)
        .find({

          where: {

            isActive:
              true,

            estado:
              EstadoUsuario.ACTIVO,

            rol: {

              codigoRol:
                'RRHH',

              isActive:
                true,
            },
          },

          order: {
            idUsuario:
              'ASC',
          },
        });

    const usuario =
      candidatos.find(
        candidato =>

          candidato.idEmpleado !==
            idEmpleado &&

          candidato.idUsuario !==
            idUsuarioJefe,
      );

    if (!usuario) {

      throw new BadRequestException(
        'Debe configurar un usuario activo de RRHH distinto del solicitante y del jefe aprobador',
      );
    }

    return usuario;
  }
}