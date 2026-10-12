import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Empleado } from '../organization/empleados/entities/empleado.entity';
import { Usuario } from '../user/entities/user.entity';
import { EstadoUsuario } from '../user/estado-usuario.enum';
import { SolicitudIncidencia } from '../solicitudes/entities/solicitud-incidencia.entity';
import { EstadoSolicitud as S } from '../solicitudes/enums/estado-solicitud.enum';
import { VacacionesPeriodo } from './entities/vacaciones-periodo.entity';
import {
  VacacionesMovimiento,
  TipoMovimientoVacaciones as T,
} from './entities/vacaciones-movimiento.entity';
import {
  asignarReservas,
  centesimas,
  decimal,
  ReservaVacaciones,
  SaldoPeriodo,
  validarReserva,
} from './vacaciones-reglas';

@Injectable()
export class VacacionesSaldoService {
  async bloquearEmpleado(manager: EntityManager, idEmpleado: number) {
    const empleado = await manager
      .getRepository(Empleado)
      .findOne({ where: { idEmpleado }, lock: { mode: 'pessimistic_write' } });
    if (!empleado) throw new NotFoundException('Empleado no encontrado');
    return empleado;
  }

  async actor(manager: EntityManager, idUsuario: number): Promise<Usuario> {
    if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0)
      throw new ForbiddenException('Identidad inválida');
    const actor = await manager
      .getRepository(Usuario)
      .findOne({
        where: { idUsuario, isActive: true, estado: EstadoUsuario.ACTIVO },
        relations: { rol: true },
      });
    if (!actor?.rol?.isActive)
      throw new ForbiddenException('Usuario o rol inactivo');
    return actor;
  }

  async empleadoRegistro(
    manager: EntityManager,
    actor: Usuario,
  ): Promise<number> {
    if (
      !actor.idEmpleado ||
      !(await manager
        .getRepository(Empleado)
        .existsBy({ idEmpleado: actor.idEmpleado, isActive: true }))
    ) {
      throw new ConflictException(
        'El usuario que registra el movimiento necesita un empleado activo asociado; RRHH debe vincularlo antes de continuar',
      );
    }
    return actor.idEmpleado;
  }

  async estado(manager: EntityManager, idEmpleado: number) {
    const periodos = await manager
      .getRepository(VacacionesPeriodo)
      .find({
        where: { idEmpleado },
        order: { fechaInicio: 'ASC', idPeriodo: 'ASC' },
      });
    const movimientos = await manager
      .getRepository(VacacionesMovimiento)
      .find({
        where: { periodo: { idEmpleado } },
        order: { idMovimiento: 'ASC' },
      });
    const solicitudes = await manager
      .getRepository(SolicitudIncidencia)
      .find({
        where: { idEmpleado, tipoIncidencia: { descuentaVacaciones: true } },
        order: { idSolicitud: 'ASC' },
      });
    const saldos = periodos.map((p) => {
      const propios = movimientos.filter((m) => m.idPeriodo === p.idPeriodo);
      const suma = (tipo: T) =>
        propios
          .filter((m) => m.tipoMovimiento === tipo)
          .reduce((n, m) => n + centesimas(m.dias), 0);
      const consumos = suma(T.CONSUMO),
        devoluciones = suma(T.DEVOLUCION);
      const positivos = suma(T.AJUSTE_POSITIVO),
        negativos = suma(T.AJUSTE_NEGATIVO);
      const saldo =
        centesimas(p.diasAsignados) -
        centesimas(p.diasUtilizadosIniciales) -
        consumos +
        devoluciones +
        positivos -
        negativos;
      return { ...p, saldo, consumos, devoluciones, positivos, negativos };
    });
    const reservas = solicitudes.filter(
      (s) => s.isActive && [S.PENDIENTE, S.EN_REVISION].includes(s.estado),
    );
    const incidencias: string[] = [];
    if (saldos.some((p) => p.saldo < 0))
      incidencias.push('Hay períodos con saldo negativo');
    for (let i = 1; i < periodos.length; i++)
      if (periodos[i - 1].fechaFin >= periodos[i].fechaInicio)
        incidencias.push('Hay períodos superpuestos');
    for (const s of solicitudes) {
      const propios = movimientos.filter(
        (m) => m.idSolicitud === s.idSolicitud,
      );
      const consumos = propios.filter((m) => m.tipoMovimiento === T.CONSUMO);
      const devoluciones = propios.filter(
        (m) => m.tipoMovimiento === T.DEVOLUCION,
      );
      const consumido = consumos.reduce((n, m) => n + centesimas(m.dias), 0);
      const devuelto = devoluciones.reduce((n, m) => n + centesimas(m.dias), 0);
      const cubiertaPorCorte =
        periodos.length > 0 &&
        !!s.fechaFin &&
        periodos.every(
          (p) => p.fechaCorteInicial && s.fechaFin! <= p.fechaCorteInicial,
        );
      if (s.estado === S.APROBADA && !consumos.length && !cubiertaPorCorte)
        incidencias.push(
          `Solicitud ${s.idSolicitud}: aprobada sin consumo ni cobertura inequívoca del corte inicial`,
        );
      if (
        consumos.length &&
        (s.diasSolicitados == null ||
          consumido !== centesimas(s.diasSolicitados) ||
          ![S.APROBADA, S.CANCELADA].includes(s.estado))
      )
        incidencias.push(`Solicitud ${s.idSolicitud}: consumo inconsistente`);
      if (s.estado === S.APROBADA && devuelto)
        incidencias.push(`Solicitud ${s.idSolicitud}: aprobada con devolución`);
      if (s.estado === S.CANCELADA && consumido !== devuelto)
        incidencias.push(
          `Solicitud ${s.idSolicitud}: cancelada sin devolución completa`,
        );
      if (
        !s.isActive &&
        ([S.PENDIENTE, S.EN_REVISION].includes(s.estado) ||
          consumido !== devuelto)
      )
        incidencias.push(
          `Solicitud ${s.idSolicitud}: baja lógica sin resolver reservas o consumos`,
        );
      for (const d of devoluciones)
        if (
          !consumos.some(
            (c) =>
              c.idPeriodo === d.idPeriodo &&
              centesimas(c.dias) === centesimas(d.dias),
          )
        )
          incidencias.push(
            `Solicitud ${s.idSolicitud}: devolución sin consumo equivalente`,
          );
    }
    return {
      periodos,
      movimientos,
      solicitudes,
      saldos,
      reservas,
      incidencias,
    };
  }

  async validarDisponibilidad(
    manager: EntityManager,
    idEmpleado: number,
    candidata?: ReservaVacaciones,
  ) {
    const estado = await this.estado(manager, idEmpleado);
    if (estado.incidencias.length)
      throw new ConflictException({
        message:
          'RRHH debe conciliar el historial antes de modificar reservas o consumos',
        incidencias: estado.incidencias,
      });
    const reservas = estado.reservas.filter(
      (s) => s.idSolicitud !== candidata?.idSolicitud,
    );
    if (candidata) {
      validarReserva(candidata);
      if (
        estado.solicitudes.some(
          (s) =>
            s.idSolicitud !== candidata.idSolicitud &&
            s.isActive &&
            s.estado === S.APROBADA &&
            s.fechaInicio! <= candidata.fechaFin! &&
            s.fechaFin! >= candidata.fechaInicio!,
        )
      )
        throw new ConflictException(
          'Las fechas se superponen con vacaciones aprobadas',
        );
      reservas.push(candidata as SolicitudIncidencia);
    }
    const planes = asignarReservas(estado.saldos, reservas);
    return candidata ? planes.get(candidata.idSolicitud)! : [];
  }

  async consumir(
    manager: EntityManager,
    solicitud: SolicitudIncidencia,
    actor: Usuario,
  ) {
    const repo = manager.getRepository(VacacionesMovimiento);
    if (await repo.existsBy({ idSolicitud: solicitud.idSolicitud }))
      throw new ConflictException(
        'La solicitud ya tiene movimientos; no se puede volver a consumir',
      );
    const idEmpleadoRegistro = await this.empleadoRegistro(manager, actor);
    const plan = await this.validarDisponibilidad(
      manager,
      solicitud.idEmpleado,
      solicitud,
    );
    await repo.save(
      plan.map((p) =>
        repo.create({
          idPeriodo: p.idPeriodo,
          idSolicitud: solicitud.idSolicitud,
          tipoMovimiento: T.CONSUMO,
          dias: decimal(p.dias),
          motivo: 'Aprobación de vacaciones',
          idEmpleadoRegistro,
        }),
      ),
    );
  }

  async devolver(
    manager: EntityManager,
    solicitud: SolicitudIncidencia,
    actor: Usuario,
  ) {
    const repo = manager.getRepository(VacacionesMovimiento);
    const movimientos = await repo.find({
      where: { idSolicitud: solicitud.idSolicitud },
      relations: { periodo: true },
    });
    const consumos = movimientos.filter((m) => m.tipoMovimiento === T.CONSUMO);
    if (!consumos.length)
      throw new ConflictException(
        'Vacaciones históricas sin consumo registrado: RRHH debe conciliar el corte inicial antes de cancelar',
      );
    if (
      movimientos.some((m) => m.tipoMovimiento !== T.CONSUMO) ||
      consumos.some((m) => m.periodo.idEmpleado !== solicitud.idEmpleado) ||
      consumos.reduce((n, m) => n + centesimas(m.dias), 0) !==
        centesimas(solicitud.diasSolicitados!)
    )
      throw new ConflictException(
        'Historial inconsistente: no es posible devolver automáticamente',
      );
    const idEmpleadoRegistro = await this.empleadoRegistro(manager, actor);
    await repo.save(
      consumos.map((c) =>
        repo.create({
          idPeriodo: c.idPeriodo,
          idSolicitud: solicitud.idSolicitud,
          tipoMovimiento: T.DEVOLUCION,
          dias: c.dias,
          motivo: 'Cancelación de vacaciones aprobadas',
          idEmpleadoRegistro,
        }),
      ),
    );
  }
}
