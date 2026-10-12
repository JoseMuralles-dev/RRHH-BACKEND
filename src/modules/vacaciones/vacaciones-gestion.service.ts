import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Empleado } from '../organization/empleados/entities/empleado.entity';
import { SolicitudIncidencia } from '../solicitudes/entities/solicitud-incidencia.entity';
import { Usuario } from '../user/entities/user.entity';
import { VacacionesPeriodo } from './entities/vacaciones-periodo.entity';
import {
  VacacionesMovimiento,
  TipoMovimientoVacaciones as T,
} from './entities/vacaciones-movimiento.entity';
import { VacacionesSaldoService } from './vacaciones-saldo.service';
import {
  AjusteVacacionesDto,
  CalendarioVacacionesDto,
  GuardarPeriodoDto,
  PaginaVacacionesDto, TablaSaldosDto,
} from './dto/saldo-vacaciones.dto';
import {
  asignarReservas,
  centesimas,
  decimal,
  fechaCalendario,
  rangoFechas,
} from './vacaciones-reglas';

@Injectable()
export class VacacionesGestionService {
  constructor(
    private readonly db: DataSource,
    private readonly saldos: VacacionesSaldoService,
  ) {}
  private esGestion(actor: Usuario) {
    return (
      ['ADMIN', 'RRHH'].includes(actor.rol.codigoRol ?? '') &&
      (actor.rol.nivelJerarquico ?? 0) >= 3
    );
  }
  private gestionar(actor: Usuario) {
    if (!this.esGestion(actor))
      throw new ForbiddenException(
        'Solo RRHH o administradores autorizados pueden gestionar saldos',
      );
  }

  async alcance(manager: EntityManager, actor: Usuario, idEmpleado: number) {
    if (!Number.isSafeInteger(idEmpleado) || idEmpleado <= 0)
      throw new ForbiddenException('Usuario sin empleado asociado');
    const empleado = await manager
      .getRepository(Empleado)
      .findOneBy({ idEmpleado });
    if (!empleado) throw new NotFoundException('Empleado no encontrado');
    if (
      !this.esGestion(actor) &&
      !(actor.idEmpleado === idEmpleado && empleado.isActive) &&
      !(
        actor.idEmpleado &&
        (actor.rol.nivelJerarquico ?? 0) >= 2 &&
        empleado.isActive &&
        empleado.idJefeDirecto === actor.idEmpleado
      )
    )
      throw new ForbiddenException('Empleado fuera de su alcance');
    return empleado;
  }

  // El alcance se obtiene de la sesión persistida, nunca de un ID de jefe enviado por el cliente.
  private alcanceTabla(actor: Usuario) {
    if (this.esGestion(actor)) return { sql: '1 = 1', params: [] as (string | number)[] };
    if (!actor.idEmpleado || (actor.rol.nivelJerarquico ?? 0) < 2)
      throw new ForbiddenException('Solo encargados, RRHH y administradores pueden consultar esta tabla');
    return { sql: 'e.id_jefe_directo = ? AND e.is_active = 1', params: [actor.idEmpleado] as (string | number)[] };
  }

  empleadosDisponibles(idUsuario: number) {
    return this.db.transaction(async manager => {
      const actor = await this.saldos.actor(manager, idUsuario);
      const filtro = this.alcanceTabla(actor);
      return manager.query(`SELECT e.id_empleado AS idEmpleado,
        CONCAT_WS(' ', e.primer_nombre, NULLIF(e.segundo_nombre, ''), e.primer_apellido, NULLIF(e.segundo_apellido, '')) AS nombreCompleto
        FROM empleados e WHERE ${filtro.sql}
        ORDER BY nombreCompleto, e.id_empleado`, filtro.params);
    });
  }

  tablaSaldos(idUsuario: number, dto: TablaSaldosDto) {
    return this.db.transaction('REPEATABLE READ', async manager => {
      const actor = await this.saldos.actor(manager, idUsuario);
      const filtro = this.alcanceTabla(actor);
      if (dto.idEmpleado !== undefined) {
        filtro.sql += ' AND e.id_empleado = ?'; filtro.params.push(dto.idEmpleado);
      }
      const nombre = "CONCAT_WS(' ', e.primer_nombre, NULLIF(e.segundo_nombre, ''), e.primer_apellido, NULLIF(e.segundo_apellido, ''))";
      if (dto.buscar?.trim()) {
        filtro.sql += ` AND LOCATE(?, ${nombre}) > 0`; filtro.params.push(dto.buscar.trim());
      }
      const from = `FROM vw_vacaciones_saldos v JOIN empleados e ON e.id_empleado = v.id_empleado WHERE ${filtro.sql}`;
      const conteos: { total: string | number }[] = await manager.query(`SELECT COUNT(*) AS total ${from}`, filtro.params);
      const orden = { nombre, saldo: 'v.saldo_dias', inicio: 'v.fecha_inicio' }[dto.orden] ?? nombre;
      const direccion = dto.direccion === 'DESC' ? 'DESC' : 'ASC';
      const items = await manager.query(`SELECT v.id_periodo AS idPeriodo, v.id_empleado AS idEmpleado,
        ${nombre} AS nombreCompleto, DATE_FORMAT(v.fecha_inicio, '%Y-%m-%d') AS fechaInicio,
        DATE_FORMAT(v.fecha_fin, '%Y-%m-%d') AS fechaFin,
        v.dias_asignados AS diasAsignados, v.dias_utilizados_iniciales AS diasUtilizadosIniciales,
        v.dias_consumidos AS diasConsumidos, v.dias_devueltos AS diasDevueltos,
        v.ajuste_neto AS ajusteNeto, v.dias_utilizados AS diasUtilizados, v.saldo_dias AS saldoDias
        ${from} ORDER BY ${orden} ${direccion}, v.id_periodo ASC LIMIT ? OFFSET ?`,
        [...filtro.params, dto.limite, (dto.pagina - 1) * dto.limite]);
      return { items, total: Number(conteos[0].total), pagina: dto.pagina, limite: dto.limite };
    });
  }
  resumen(idUsuario: number, idEmpleado?: number) {
    return this.db.transaction('REPEATABLE READ', async (manager) => {
      const actor = await this.saldos.actor(manager, idUsuario);
      const id = idEmpleado ?? actor.idEmpleado!;
      await this.alcance(manager, actor, id);
      const e = await this.saldos.estado(manager, id);
      let reservas = 0;
      for (const s of e.reservas) {
        if (!Number.isSafeInteger(s.diasSolicitados) || s.diasSolicitados! <= 0)
          e.incidencias.push(`Solicitud ${s.idSolicitud}: días inválidos`);
        else reservas += centesimas(s.diasSolicitados!);
      }
      try {
        asignarReservas(e.saldos, e.reservas);
      } catch (error) {
        e.incidencias.push((error as Error).message);
      }
      const total = e.saldos.reduce((n, p) => n + p.saldo, 0);
      return {
        idEmpleado: id,
        saldoTotal: decimal(total),
        diasReservados: decimal(reservas),
        diasDisponibles: decimal(total - reservas),
        requiereConciliacion: e.incidencias.length > 0,
        incidencias: [...new Set(e.incidencias)],
        periodos: e.saldos.map((p) => ({
          idPeriodo: p.idPeriodo,
          fechaInicio: p.fechaInicio,
          fechaFin: p.fechaFin,
          fechaCorteInicial: p.fechaCorteInicial,
          diasAsignados: p.diasAsignados,
          diasUtilizadosIniciales: p.diasUtilizadosIniciales,
          diasConsumidos: decimal(p.consumos),
          diasDevueltos: decimal(p.devoluciones),
          ajustesPositivos: decimal(p.positivos),
          ajustesNegativos: decimal(p.negativos),
          ajusteNeto: decimal(p.positivos - p.negativos),
          saldoDias: decimal(p.saldo),
        })),
      };
    });
  }

  periodos(idUsuario: number, idEmpleado: number, pagina: PaginaVacacionesDto) {
    return this.db.transaction(async (manager) => {
      const actor = await this.saldos.actor(manager, idUsuario);
      await this.alcance(manager, actor, idEmpleado);
      const [items, total] = await manager
        .getRepository(VacacionesPeriodo)
        .findAndCount({
          where: { idEmpleado },
          order: { fechaInicio: 'ASC', idPeriodo: 'ASC' },
          take: pagina.limite,
          skip: (pagina.pagina - 1) * pagina.limite,
        });
      // Las observaciones administrativas no se exponen fuera de RRHH/ADMIN.
      return {
        items: items.map((p) =>
          this.esGestion(actor) ? p : { ...p, observaciones: undefined },
        ),
        total,
        ...pagina,
      };
    });
  }

  movimientos(
    idUsuario: number,
    pagina: PaginaVacacionesDto,
    idEmpleado?: number,
  ) {
    return this.db.transaction(async (manager) => {
      const actor = await this.saldos.actor(manager, idUsuario);
      const id = idEmpleado ?? actor.idEmpleado!;
      await this.alcance(manager, actor, id);
      const [items, total] = await manager
        .getRepository(VacacionesMovimiento)
        .findAndCount({
          where: { periodo: { idEmpleado: id } },
          order: { idMovimiento: 'DESC' },
          take: pagina.limite,
          skip: (pagina.pagina - 1) * pagina.limite,
        });
      return {
        items: items.map((m) =>
          this.esGestion(actor) || id === actor.idEmpleado
            ? m
            : { ...m, motivo: undefined },
        ),
        total,
        ...pagina,
      };
    });
  }

  guardarPeriodo(
    idUsuario: number,
    idEmpleado: number,
    dto: GuardarPeriodoDto,
    idPeriodo?: number,
  ) {
    return this.db.transaction('READ COMMITTED', async (manager) => {
      const actor = await this.saldos.actor(manager, idUsuario);
      this.gestionar(actor);
      const empleado = await this.saldos.bloquearEmpleado(manager, idEmpleado);
      if (!empleado.isActive)
        throw new BadRequestException('Empleado inactivo');
      rangoFechas(dto.fechaInicio, dto.fechaFin);
      const asignados = centesimas(dto.diasAsignados),
        iniciales = centesimas(dto.diasUtilizadosIniciales);
      if (
        asignados < 0 ||
        asignados > 999999 ||
        iniciales < 0 ||
        iniciales > asignados
      )
        throw new BadRequestException('Valores iniciales fuera de rango');
      if (iniciales > 0 && !dto.fechaCorteInicial)
        throw new BadRequestException(
          'El consumo inicial requiere fecha de corte',
        );
      if (dto.fechaCorteInicial) fechaCalendario(dto.fechaCorteInicial);
      const repo = manager.getRepository(VacacionesPeriodo);
      const anteriores = await repo.find({ where: { idEmpleado } });
      const anterior = idPeriodo
        ? anteriores.find((p) => p.idPeriodo === idPeriodo)
        : undefined;
      if (idPeriodo && !anterior)
        throw new NotFoundException('Período no encontrado para ese empleado');
      if (
        anteriores.some(
          (p) =>
            p.idPeriodo !== idPeriodo &&
            p.fechaInicio <= dto.fechaFin &&
            p.fechaFin >= dto.fechaInicio,
        )
      )
        throw new ConflictException(
          'El período se superpone con otro existente',
        );
      if (
        anterior &&
        (await manager
          .getRepository(VacacionesMovimiento)
          .existsBy({ idPeriodo }))
      ) {
        if (
          anterior.fechaInicio !== dto.fechaInicio ||
          anterior.fechaFin !== dto.fechaFin ||
          anterior.fechaCorteInicial !== (dto.fechaCorteInicial ?? null) ||
          centesimas(anterior.diasAsignados) !== asignados ||
          centesimas(anterior.diasUtilizadosIniciales) !== iniciales
        )
          throw new ConflictException(
            'El período tiene movimientos: corrija el saldo mediante ajustes',
          );
      }
      const result = await repo.save(
        repo.create({
          ...anterior,
          idEmpleado,
          ...dto,
          diasAsignados: decimal(asignados),
          diasUtilizadosIniciales: decimal(iniciales),
          fechaCorteInicial: dto.fechaCorteInicial ?? null,
          observaciones: dto.observaciones?.trim() || null,
        }),
      );
      const e = await this.saldos.estado(manager, idEmpleado);
      asignarReservas(e.saldos, e.reservas);
      return result;
    });
  }

  ajustar(
    idUsuario: number,
    idEmpleado: number,
    idPeriodo: number,
    dto: AjusteVacacionesDto,
  ) {
    return this.db.transaction('READ COMMITTED', async (manager) => {
      const actor = await this.saldos.actor(manager, idUsuario);
      this.gestionar(actor);
      await this.saldos.bloquearEmpleado(manager, idEmpleado);
      const idEmpleadoRegistro = await this.saldos.empleadoRegistro(
        manager,
        actor,
      );
      if (
        !(await manager
          .getRepository(VacacionesPeriodo)
          .existsBy({ idPeriodo, idEmpleado }))
      )
        throw new NotFoundException('Período no encontrado para ese empleado');
      const dias = centesimas(dto.dias);
      if (dias <= 0 || dias > 999999 || !dto.motivo?.trim())
        throw new BadRequestException(
          'El ajuste requiere días positivos y motivo',
        );
      const repo = manager.getRepository(VacacionesMovimiento);
      const result = await repo.save(
        repo.create({
          idPeriodo,
          idSolicitud: null,
          tipoMovimiento: dto.tipoMovimiento as T,
          dias: decimal(dias),
          motivo: dto.motivo.trim(),
          idEmpleadoRegistro,
        }),
      );
      if (dto.tipoMovimiento === T.AJUSTE_NEGATIVO) {
        const e = await this.saldos.estado(manager, idEmpleado);
        asignarReservas(e.saldos, e.reservas);
      }
      return result;
    });
  }

  calendario(idUsuario: number, dto: CalendarioVacacionesDto, equipo = false) {
    rangoFechas(dto.desde, dto.hasta);
    if (
      fechaCalendario(dto.hasta) - fechaCalendario(dto.desde) >
      365 * 86400000
    )
      throw new BadRequestException(
        'El rango máximo es de 366 días inclusivos',
      );
    return this.db.transaction(async (manager) => {
      const actor = await this.saldos.actor(manager, idUsuario);
      if (!actor.idEmpleado)
        throw new ForbiddenException('Usuario sin empleado asociado');
      await this.alcance(manager, actor, actor.idEmpleado);
      if (equipo && ![2, 3, 4].includes(actor.rol.nivelJerarquico ?? 0))
        throw new ForbiddenException('Sin permiso de equipo');
      const qb = manager
        .getRepository(SolicitudIncidencia)
        .createQueryBuilder('s')
        .innerJoin('s.tipoIncidencia', 't')
        .innerJoinAndSelect('s.empleado', 'e')
        .select([
          's.idSolicitud',
          's.idEmpleado',
          's.fechaInicio',
          's.fechaFin',
          's.diasSolicitados',
          's.estado',
          'e.idEmpleado',
          'e.primerNombre',
          'e.primerApellido',
        ])
        .where('t.descuentaVacaciones = :vacaciones', { vacaciones: true })
        .andWhere('s.isActive = :activo', { activo: true })
        .andWhere('s.fechaInicio <= :hasta AND s.fechaFin >= :desde', {
          desde: dto.desde,
          hasta: dto.hasta,
        });
      if (equipo)
        qb.andWhere('e.idJefeDirecto = :id AND e.isActive = :activo', {
          id: actor.idEmpleado,
          activo: true,
        });
      else qb.andWhere('s.idEmpleado = :id', { id: actor.idEmpleado });
      const [items, total] = await qb
        .orderBy('s.fechaInicio', 'ASC')
        .addOrderBy('s.idSolicitud', 'ASC')
        .take(dto.limite)
        .skip((dto.pagina - 1) * dto.limite)
        .getManyAndCount();
      return {
        items: items.map((s) => ({
          idSolicitud: s.idSolicitud,
          empleado: {
            idEmpleado: s.idEmpleado,
            nombre: `${s.empleado.primerNombre} ${s.empleado.primerApellido}`,
          },
          fechaInicio: s.fechaInicio,
          fechaFin: s.fechaFin,
          diasSolicitados: s.diasSolicitados,
          estado: s.estado,
        })),
        total,
        pagina: dto.pagina,
        limite: dto.limite,
      };
    });
  }
}
