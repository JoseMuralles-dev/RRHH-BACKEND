import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { Empleado } from '../organization/empleados/entities/empleado.entity';
import { SolicitudIncidencia } from '../solicitudes/entities/solicitud-incidencia.entity';
import { EstadoSolicitud } from '../solicitudes/enums/estado-solicitud.enum';
import { MisVacacionesResponseDto, VacacionResponseDto } from './dto/vacacion-response.dto';

export function fechaActualGuatemala(fecha = new Date()): string {
  const partes = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(fecha);
  const parte = (tipo: string) => partes.find(p => p.type === tipo)!.value;
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

@Injectable()
export class VacacionesService {
  constructor(
    @InjectRepository(SolicitudIncidencia)
    private readonly solicitudes: Repository<SolicitudIncidencia>,
    @InjectRepository(Empleado)
    private readonly empleados: Repository<Empleado>,
  ) {}

  async misVacaciones(
    idEmpleado: number | null | undefined,
    anio = Number(fechaActualGuatemala().slice(0, 4)),
  ): Promise<MisVacacionesResponseDto> {
    const consulta = await this.consultaDelEmpleado(idEmpleado);
    const registros = await this.filtrarAnio(consulta, anio)
      .orderBy('solicitud.fechaInicio', 'ASC')
      .addOrderBy('solicitud.idSolicitud', 'ASC').getMany();
    const respuesta: MisVacacionesResponseDto = {
      anio, pendientes: [], aprobadas: [], rechazadas: [], canceladas: [],
    };
    for (const solicitud of registros) {
      const item = this.presentar(solicitud);
      switch (solicitud.estado) {
        case EstadoSolicitud.PENDIENTE:
        case EstadoSolicitud.EN_REVISION: respuesta.pendientes.push(item); break;
        case EstadoSolicitud.APROBADA: respuesta.aprobadas.push(item); break;
        case EstadoSolicitud.RECHAZADA: respuesta.rechazadas.push(item); break;
        case EstadoSolicitud.CANCELADA: respuesta.canceladas.push(item); break;
      }
    }
    return respuesta;
  }

  async proximas(idEmpleado: number | null | undefined): Promise<VacacionResponseDto[]> {
    const consulta = await this.consultaDelEmpleado(idEmpleado);
    const solicitudes = await consulta
      .andWhere('solicitud.estado = :estado', { estado: EstadoSolicitud.APROBADA })
      .andWhere('solicitud.fechaInicio >= :hoy', { hoy: fechaActualGuatemala() })
      .orderBy('solicitud.fechaInicio', 'ASC')
      .addOrderBy('solicitud.idSolicitud', 'ASC').getMany();
    return solicitudes.map(s => this.presentar(s));
  }

  async historial(
    idEmpleado: number | null | undefined,
    anio = Number(fechaActualGuatemala().slice(0, 4)),
  ): Promise<{ anio: number; solicitudes: VacacionResponseDto[] }> {
    const consulta = await this.consultaDelEmpleado(idEmpleado);
    const solicitudes = await this.filtrarAnio(consulta, anio)
      .andWhere(new Brackets(q => q
        .where('COALESCE(solicitud.fechaFin, solicitud.fechaInicio) < :hoy', { hoy: fechaActualGuatemala() })
        .orWhere('solicitud.estado IN (:...resueltas)', {
          resueltas: [EstadoSolicitud.APROBADA, EstadoSolicitud.RECHAZADA, EstadoSolicitud.CANCELADA],
        })
        .orWhere('solicitud.fechaResolucion IS NOT NULL')))
      .orderBy('solicitud.fechaInicio', 'DESC')
      .addOrderBy('solicitud.idSolicitud', 'DESC').getMany();
    return { anio, solicitudes: solicitudes.map(s => this.presentar(s)) };
  }

  private async consultaDelEmpleado(idEmpleado: number | null | undefined) {
    // Nunca pasar undefined a TypeORM: podría suprimir el filtro de propietario.
    if (typeof idEmpleado !== 'number' || !Number.isSafeInteger(idEmpleado) || idEmpleado <= 0) {
      throw new ForbiddenException('Tu usuario no tiene un empleado asociado.');
    }
    const empleado = await this.empleados.findOne({
      select: { idEmpleado: true }, where: { idEmpleado, isActive: true },
    });
    if (!empleado) throw new ForbiddenException('El empleado asociado no existe o está inactivo.');

    return this.solicitudes.createQueryBuilder('solicitud')
      .innerJoinAndSelect('solicitud.tipoIncidencia', 'tipo')
      .select([
        'solicitud.idSolicitud', 'solicitud.fechaInicio', 'solicitud.fechaFin',
        'solicitud.diasSolicitados', 'solicitud.motivo', 'solicitud.estado',
        'solicitud.fechaResolucion', 'tipo.idTipoIncidencia', 'tipo.nombre',
      ])
      .where('solicitud.idEmpleado = :idEmpleado', { idEmpleado })
      .andWhere('solicitud.isActive = :activa', { activa: true })
      .andWhere('tipo.descuentaVacaciones = :descuenta', { descuenta: true });
  }

  private filtrarAnio(consulta: SelectQueryBuilder<SolicitudIncidencia>, anio: number) {
    // Solapamiento con el año; no duplicar ni prorratear los días solicitados.
    return consulta
      .andWhere('COALESCE(solicitud.fechaInicio, solicitud.fechaFin) <= :finAnio', { finAnio: `${anio}-12-31` })
      .andWhere('COALESCE(solicitud.fechaFin, solicitud.fechaInicio) >= :inicioAnio', { inicioAnio: `${anio}-01-01` });
  }

  private presentar(s: SolicitudIncidencia): VacacionResponseDto {
    return {
      idSolicitud: s.idSolicitud, fechaInicio: s.fechaInicio, fechaFin: s.fechaFin,
      diasSolicitados: s.diasSolicitados, motivo: s.motivo,
      estadoSolicitud: s.estado, fechaResolucion: s.fechaResolucion ?? null,
      nombreTipo: s.tipoIncidencia.nombre,
    };
  }
}
