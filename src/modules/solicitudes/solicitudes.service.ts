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


@Injectable()
export class SolicitudesService {
  constructor(
    @InjectRepository(SolicitudIncidencia) private readonly solicitudRepository: Repository<SolicitudIncidencia>,
    @InjectRepository(TipoIncidencia) private readonly tipoRepository: Repository<TipoIncidencia>,
    @InjectRepository(AprobacionIncidencia) private readonly aprobacionRepository: Repository<AprobacionIncidencia>,
    @InjectRepository(Empleado) private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(Usuario) private readonly usuarioRepository: Repository<Usuario>,
    private readonly dataSource: DataSource,
  ) {}

  async create(idEmpleado: number | null, dto: CreateSolicitudDto) {
    if (!idEmpleado) 
        throw new BadRequestException('El usuario autenticado no está asociado a un empleado');
    if (!dto.motivo?.trim()) 
        throw new BadRequestException('Debe indicar el motivo de la solicitud');

    return this.dataSource.transaction(async manager => {
      const empleado = await manager.getRepository(Empleado).findOne({
        where: { idEmpleado, isActive: true },
        relations: { jefeDirecto: { usuario: { rol: true } } },
      });
      if (!empleado) throw new NotFoundException('Empleado no encontrado');
      const tipo = await manager.getRepository(TipoIncidencia).findOne({
        where: { idTipoIncidencia: dto.idTipoIncidencia, isActive: true },
      });
      if (!tipo) throw new NotFoundException('El tipo de incidencia no existe o está inactivo');
      let diasSolicitados: number | null = null;
      if (tipo.requierePeriodo) {
        if (dto.fechaInicio == null || dto.fechaFin == null || dto.diasSolicitados == null) {
          throw new BadRequestException('Este tipo de solicitud requiere fechas y dias laborables');
        }
        diasSolicitados = validarPeriodo(dto.fechaInicio, dto.fechaFin, dto.diasSolicitados);
      } else if (dto.fechaInicio != null || dto.fechaFin != null || dto.diasSolicitados != null) {
        throw new BadRequestException('Este tipo de solicitud no admite fechas ni dias laborables');
      }
      const jefe = empleado.jefeDirecto;
      const usuarioJefe = jefe?.usuario;
      if (!jefe?.isActive || jefe.idEmpleado === idEmpleado || !usuarioJefe?.isActive
        || usuarioJefe.estado !== EstadoUsuario.ACTIVO || !usuarioJefe.rol?.isActive) {
        throw new BadRequestException('Debe asignar un jefe directo distinto al solicitante, con empleado, usuario y rol activos');
      }
      const aprobadores = usuarioJefe.rol.codigoRol === 'RRHH'
        ? [usuarioJefe]
        : [usuarioJefe, await this.obtenerUsuarioRRHH(manager, idEmpleado, usuarioJefe.idUsuario)];
      const solicitudRepo = manager.getRepository(SolicitudIncidencia);
      const aprobacionRepo = manager.getRepository(AprobacionIncidencia);
      const solicitud = await solicitudRepo.save(solicitudRepo.create({
        idEmpleado, idTipoIncidencia: dto.idTipoIncidencia,
        fechaInicio: tipo.requierePeriodo ? dto.fechaInicio! : null, fechaFin: tipo.requierePeriodo ? dto.fechaFin! : null,
        diasSolicitados, motivo: dto.motivo.trim(),
        estado: EstadoSolicitud.PENDIENTE, isActive: true,
      }));
      await aprobacionRepo.save(aprobadores.map((usuario, index) => aprobacionRepo.create({
        idSolicitud: solicitud.idSolicitud, idUsuarioAprobador: usuario.idUsuario,
        nivelAprobacion: index + 1, estado: EstadoAprobacion.PENDIENTE,
      })));
      return solicitud;
    });
  }

  findTiposIncidencia() {
    return this.tipoRepository.find({
      where: { isActive: true }, order: { nombre: 'ASC' },
      select: { idTipoIncidencia: true, nombre: true, requierePeriodo: true, esRemunerado: true, descuentaVacaciones: true },
    });
  }

  findMisSolicitudes(idEmpleado: number | null) {
    if (!idEmpleado) throw new BadRequestException('Usuario sin empleado asociado');
    return this.solicitudRepository.find({
      where: { idEmpleado, isActive: true },
      relations: { tipoIncidencia: true, aprobaciones: { usuarioAprobador: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async findPendientesAprobacion(idUsuario: number) {
    await this.validarAprobador(this.usuarioRepository, idUsuario);
    const pendientes = await this.aprobacionRepository.find({
      where: {
        idUsuarioAprobador: idUsuario, estado: EstadoAprobacion.PENDIENTE,
        solicitud: { isActive: true, estado: In(ESTADOS_ABIERTOS) },
      },
      relations: { solicitud: { empleado: true, tipoIncidencia: true, aprobaciones: true } },
      order: { createdAt: 'ASC' },
    });
    return pendientes.filter(a => aprobacionDisponible(a.solicitud.aprobaciones ?? [])?.idAprobacion === a.idAprobacion);
  }

  async findAprobadas(idUsuario: number) {
    await this.validarAprobador(this.usuarioRepository, idUsuario);
    const aprobadas = await this.aprobacionRepository.find({ 
        where: {
            idUsuarioAprobador: idUsuario, estado: EstadoAprobacion.APROBADA,
            solicitud: { isActive: true, estado: In(ESTADOS_APROBADA)},
        },
         relations: { solicitud: { empleado: true, tipoIncidencia: true, aprobaciones: true } },
      order: { createdAt: 'ASC' },
    });
    return aprobadas.filter(a => a.solicitud.estado === EstadoSolicitud.APROBADA);
    }


  async findOne(idSolicitud: number, usuario: { idUsuario: number; idEmpleado?: number | null; nivelJerarquico: number }) {
    const solicitud = await this.solicitudRepository.findOne({
      where: { idSolicitud, isActive: true },
      relations: { empleado: true, tipoIncidencia: true, aprobaciones: { usuarioAprobador: true } },
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    if (solicitud.idEmpleado !== usuario.idEmpleado && usuario.nivelJerarquico < 3
      && !solicitud.aprobaciones?.some(a => a.idUsuarioAprobador === usuario.idUsuario)) {
      throw new ForbiddenException('No tiene permiso para visualizar esta solicitud');
    }
    return solicitud;
  }

  aprobar(idSolicitud: number, idUsuario: number, dto: ResolverAprobacionDto) {
    return this.resolver(idSolicitud, idUsuario, dto, EstadoAprobacion.APROBADA);
  }

  async rechazar(idSolicitud: number, idUsuario: number, dto: ResolverAprobacionDto) {
    if (!dto.comentario?.trim()) throw new BadRequestException('Debe indicar el motivo del rechazo');
    return this.resolver(idSolicitud, idUsuario, dto, EstadoAprobacion.RECHAZADA);
  }

  private resolver(idSolicitud: number, idUsuario: number, dto: ResolverAprobacionDto, estado: EstadoAprobacion) {
    return this.dataSource.transaction('READ COMMITTED', async manager => {
      // All state-changing operations acquire the same parent row first.
      const solicitud = await this.solicitudAbiertaBloqueada(manager, idSolicitud);
      const actor = await this.validarAprobador(manager.getRepository(Usuario), idUsuario);
      if (actor.idEmpleado === solicitud.idEmpleado) throw new ForbiddenException('No puede resolver su propia solicitud');
      const aprobacionRepo = manager.getRepository(AprobacionIncidencia);
      const aprobaciones = await aprobacionRepo.find({ where: { idSolicitud }, order: { nivelAprobacion: 'ASC' } });
      const aprobacion = aprobacionDisponible(aprobaciones);
      if (!aprobacion || aprobacion.idUsuarioAprobador !== idUsuario) {
        throw new ForbiddenException('No tiene una aprobación disponible en el nivel actual de esta solicitud');
      }
      aprobacion.estado = estado;
      aprobacion.comentario = dto.comentario?.trim() || null;
      aprobacion.fechaRespuesta = new Date();
      await aprobacionRepo.save(aprobacion);

      if (estado === EstadoAprobacion.RECHAZADA) {
        solicitud.estado = EstadoSolicitud.RECHAZADA;
        solicitud.fechaResolucion = new Date();
      } else if (aprobaciones.every(a => a.estado === EstadoAprobacion.APROBADA)) {
        solicitud.estado = EstadoSolicitud.APROBADA;
        solicitud.fechaResolucion = new Date();
      } else {
        solicitud.estado = EstadoSolicitud.EN_REVISION;
      }
      return manager.getRepository(SolicitudIncidencia).save(solicitud);
    });
  }

  cancelar(idSolicitud: number, usuario: { idEmpleado?: number | null; nivelJerarquico: number }) {
    return this.dataSource.transaction('READ COMMITTED', async manager => {
      const solicitud = await this.solicitudAbiertaBloqueada(manager, idSolicitud);
      if (solicitud.idEmpleado !== usuario.idEmpleado && usuario.nivelJerarquico < 4) {
        throw new ForbiddenException('No tiene permiso para cancelar esta solicitud');
      }
      solicitud.estado = EstadoSolicitud.CANCELADA;
      solicitud.fechaResolucion = new Date();
      // Unanswered approval rows remain as history; closed requests are never actionable.
      return manager.getRepository(SolicitudIncidencia).save(solicitud);
    });
  }

  private async solicitudAbiertaBloqueada(manager: EntityManager, idSolicitud: number) {
    const solicitud = await manager.getRepository(SolicitudIncidencia).findOne({
      where: { idSolicitud, isActive: true }, lock: { mode: 'pessimistic_write' },
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    if (!ESTADOS_ABIERTOS.includes(solicitud.estado)) throw new BadRequestException('La solicitud ya fue resuelta');
    return solicitud;
  }

  private async validarAprobador(repo: Repository<Usuario>, idUsuario: number) {
    const usuario = await repo.findOne({
      where: { idUsuario, isActive: true, estado: EstadoUsuario.ACTIVO, rol: { isActive: true } },
    });
    if (!usuario) throw new ForbiddenException('El usuario aprobador no está activo');
    return usuario;
  }

  private async obtenerUsuarioRRHH(manager: EntityManager, idEmpleado: number, idUsuarioJefe: number) {
    const candidatos = await manager.getRepository(Usuario).find({
      where: { isActive: true, estado: EstadoUsuario.ACTIVO, rol: { codigoRol: 'RRHH', isActive: true } },
      order: { idUsuario: 'ASC' },
    });
    const usuario = candidatos.find(u => u.idEmpleado !== idEmpleado && u.idUsuario !== idUsuarioJefe);
    if (!usuario) throw new BadRequestException('Debe configurar un usuario activo de RRHH distinto del solicitante y del jefe aprobador');
    return usuario;
  }
}
