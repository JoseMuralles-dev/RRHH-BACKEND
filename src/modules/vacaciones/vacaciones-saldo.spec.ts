import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { VacacionesSaldoService } from './vacaciones-saldo.service';
import { VacacionesGestionService } from './vacaciones-gestion.service';
import { VacacionesPeriodo } from './entities/vacaciones-periodo.entity';
import { VacacionesMovimiento } from './entities/vacaciones-movimiento.entity';
import { SolicitudesService } from '../solicitudes/solicitudes.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { SolicitudIncidencia } from '../solicitudes/entities/solicitud-incidencia.entity';
import { TipoIncidencia } from '../solicitudes/entities/tipo-incidencia.entity';
import { AprobacionIncidencia } from '../solicitudes/entities/aprobacion-incidencia.entity';
import { Empleado } from '../organization/empleados/entities/empleado.entity';
import { Usuario } from '../user/entities/user.entity';
import {
  asignarReservas,
  centesimas,
  decimal,
  fechaCalendario,
} from './vacaciones-reglas';

// Repositorios en memoria: prueban el flujo y rollback, NO los bloqueos de MySQL.
describe('Vacaciones: integración de servicios y reglas contables', () => {
  let tablas: Record<string, any[]>;
  let manager: EntityManager;
  let db: DataSource;
  let saldo: VacacionesSaldoService;
  let gestion: VacacionesGestionService;
  let solicitudes: SolicitudesService;
  let bloqueos: string[];
  const entidades = new Map<any, string>([
    [VacacionesPeriodo, 'periodos'],
    [VacacionesMovimiento, 'movimientos'],
    [SolicitudIncidencia, 'solicitudes'],
    [TipoIncidencia, 'tipos'],
    [AprobacionIncidencia, 'aprobaciones'],
    [Empleado, 'empleados'],
    [Usuario, 'usuarios'],
  ]);
  const keys: Record<string, string> = {
    periodos: 'idPeriodo',
    movimientos: 'idMovimiento',
    solicitudes: 'idSolicitud',
    tipos: 'idTipoIncidencia',
    aprobaciones: 'idAprobacion',
    empleados: 'idEmpleado',
    usuarios: 'idUsuario',
  };
  const clon = <T>(v: T): T => structuredClone(v);
  const dto = {
    idTipoIncidencia: 1,
    fechaInicio: '2026-10-05',
    fechaFin: '2026-10-09',
    diasSolicitados: 5,
    motivo: 'Descanso',
  };
  beforeEach(() => {
    bloqueos = [];
    tablas = {
      periodos: [
        {
          idPeriodo: 1,
          idEmpleado: 10,
          fechaInicio: '2024-01-01',
          fechaFin: '2024-12-31',
          fechaCorteInicial: '2025-12-31',
          diasAsignados: '5.00',
          diasUtilizadosIniciales: '2.00',
        },
        {
          idPeriodo: 2,
          idEmpleado: 10,
          fechaInicio: '2025-01-01',
          fechaFin: '2025-12-31',
          fechaCorteInicial: '2025-12-31',
          diasAsignados: '5.00',
          diasUtilizadosIniciales: '0.00',
        },
      ],
      movimientos: [],
      solicitudes: [
        {
          idSolicitud: 1,
          idEmpleado: 10,
          ...dto,
          estado: 'PENDIENTE',
          isActive: true,
        },
      ],
      tipos: [
        {
          idTipoIncidencia: 1,
          descuentaVacaciones: true,
          requierePeriodo: true,
          isActive: true,
        },
      ],
      aprobaciones: [
        {
          idAprobacion: 1,
          idSolicitud: 1,
          idUsuarioAprobador: 30,
          nivelAprobacion: 1,
          estado: 'PENDIENTE',
        },
      ],
      empleados: [
        { idEmpleado: 10, idJefeDirecto: 20, isActive: true },
        { idEmpleado: 20, isActive: true },
        { idEmpleado: 30, isActive: true },
        { idEmpleado: 99, idJefeDirecto: 88, isActive: true },
      ],
      usuarios: [
        {
          idUsuario: 10,
          idEmpleado: 10,
          isActive: true,
          estado: 'ACTIVO',
          rol: { isActive: true, nivelJerarquico: 1, codigoRol: 'EMPLEADO' },
        },
        {
          idUsuario: 20,
          idEmpleado: 20,
          isActive: true,
          estado: 'ACTIVO',
          rol: { isActive: true, nivelJerarquico: 2, codigoRol: 'JEFE_AREA' },
        },
        {
          idUsuario: 30,
          idEmpleado: 30,
          isActive: true,
          estado: 'ACTIVO',
          rol: { isActive: true, nivelJerarquico: 3, codigoRol: 'RRHH' },
        },
        {
          idUsuario: 40,
          idEmpleado: null,
          isActive: true,
          estado: 'ACTIVO',
          rol: { isActive: true, nivelJerarquico: 4, codigoRol: 'ADMIN' },
        },
      ],
    };
    const matches = (row: any, where: any): boolean =>
      Object.entries(where ?? {}).every(([key, value]) => {
        if (value && typeof value === 'object') {
          const related =
            key === 'periodo'
              ? tablas.periodos.find((p) => p.idPeriodo === row.idPeriodo)
              : key === 'tipoIncidencia'
                ? tablas.tipos.find(
                    (t) => t.idTipoIncidencia === row.idTipoIncidencia,
                  )
                : row[key];
          return !!related && matches(related, value);
        }
        return row[key] === value;
      });
    const repo = (entity: any): any => {
      const name = entidades.get(entity)!;
      if (!name) throw new Error('Repositorio desconocido');
      const find = async (options: any = {}) =>
        tablas[name]
          .filter((row) => matches(row, options.where))
          .map((row) => {
            const item = clon(row);
            if (options.relations?.periodo)
              item.periodo = clon(
                tablas.periodos.find((p) => p.idPeriodo === row.idPeriodo),
              );
            return item;
          });
      return {
        find,
        findOne: async (o: any) => {
          if (o.lock) bloqueos.push(name);
          return (await find(o))[0] ?? null;
        },
        findOneBy: async (where: any) => (await find({ where }))[0] ?? null,
        existsBy: async (where: any) => (await find({ where })).length > 0,
        create: (v: any) => clon(v),
        save: async (input: any) => {
          const saveOne = (v: any) => {
            const k = keys[name];
            const copy = clon(v);
            if (!copy[k])
              copy[k] = Math.max(0, ...tablas[name].map((x) => x[k])) + 1;
            const index = tablas[name].findIndex((x) => x[k] === copy[k]);
            if (index < 0) tablas[name].push(copy);
            else tablas[name][index] = copy;
            return clon(copy);
          };
          return Array.isArray(input) ? input.map(saveOne) : saveOne(input);
        },
      };
    };
    manager = { getRepository: repo } as unknown as EntityManager;
    db = {
      transaction: async (...args: any[]) => {
        const snapshot = clon(tablas);
        try {
          return await args.at(-1)(manager);
        } catch (e) {
          tablas = snapshot;
          throw e;
        }
      },
    } as unknown as DataSource;
    saldo = new VacacionesSaldoService();
    gestion = new VacacionesGestionService(db, saldo);
    solicitudes = new SolicitudesService(
      repo(SolicitudIncidencia),
      repo(TipoIncidencia),
      repo(AprobacionIncidencia),
      repo(Empleado),
      repo(Usuario),
      db,
      saldo,
      {
        crear: jest.fn().mockResolvedValue(null),
        notificarNuevaSolicitud: jest.fn().mockResolvedValue(null),
        notificarSolicitudAprobada: jest.fn().mockResolvedValue(null),
        notificarSolicitudRechazada: jest.fn().mockResolvedValue(null),
      } as unknown as NotificacionesService,
    );
  });

  it('consume entre dos períodos y conserva el histórico inicial', async () => {
    await solicitudes.aprobar(1, 30, {});
    expect(tablas.movimientos.map((m) => [m.idPeriodo, m.dias])).toEqual([
      [1, '3.00'],
      [2, '2.00'],
    ]);
    expect(tablas.solicitudes[0].estado).toBe('APROBADA');
    expect(tablas.periodos[0].diasUtilizadosIniciales).toBe('2.00');
    expect(bloqueos.slice(0, 2)).toEqual(['empleados', 'solicitudes']);
    const resumen = await gestion.resumen(10);
    expect(resumen).toMatchObject({
      saldoTotal: '3.00',
      diasReservados: '0.00',
      diasDisponibles: '3.00',
    });
  });
  it('las reservas reducen disponibilidad sin generar movimientos', async () => {
    expect(await gestion.resumen(10)).toMatchObject({
      saldoTotal: '8.00',
      diasReservados: '5.00',
      diasDisponibles: '3.00',
    });
    expect(tablas.movimientos).toEqual([]);
  });
  it('edita sin contar dos veces su reserva', async () => {
    await solicitudes.editar(1, 10, {
      ...dto,
      fechaFin: '2026-10-08',
      diasSolicitados: 4,
    });
    expect((await gestion.resumen(10)).diasReservados).toBe('4.00');
  });
  it('respeta otras reservas y revierte aprobación y consumos si falta saldo', async () => {
    tablas.solicitudes.push({
      ...tablas.solicitudes[0],
      idSolicitud: 2,
      fechaInicio: '2026-10-12',
      fechaFin: '2026-10-16',
    });
    await expect(solicitudes.aprobar(1, 30, {})).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tablas.movimientos).toHaveLength(0);
    expect(tablas.aprobaciones[0].estado).toBe('PENDIENTE');
    expect(tablas.solicitudes[0].estado).toBe('PENDIENTE');
  });
  it('un reintento de aprobación no duplica consumos', async () => {
    await solicitudes.aprobar(1, 30, {});
    await expect(solicitudes.aprobar(1, 30, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tablas.movimientos).toHaveLength(2);
  });
  it('cancela y devuelve a los mismos períodos; no se reabre', async () => {
    await solicitudes.aprobar(1, 30, {});
    await solicitudes.cancelar(1, {
      idUsuario: 10,
      idEmpleado: 10,
      nivelJerarquico: 1,
    });
    expect(
      tablas.movimientos
        .filter((m) => m.tipoMovimiento === 'DEVOLUCION')
        .map((m) => [m.idPeriodo, m.dias]),
    ).toEqual([
      [1, '3.00'],
      [2, '2.00'],
    ]);
    expect((await gestion.resumen(10)).saldoTotal).toBe('8.00');
    await expect(solicitudes.aprobar(1, 30, {})).rejects.toThrow();
    await expect(
      solicitudes.cancelar(1, {
        idUsuario: 10,
        idEmpleado: 10,
        nivelJerarquico: 1,
      }),
    ).rejects.toThrow();
    expect(tablas.movimientos).toHaveLength(4);
  });
  it('cancela pendientes sin devolución', async () => {
    await solicitudes.cancelar(1, {
      idUsuario: 10,
      idEmpleado: 10,
      nivelJerarquico: 1,
    });
    expect(tablas.movimientos).toHaveLength(0);
    expect((await gestion.resumen(10)).diasReservados).toBe('0.00');
  });
  it('rechaza un empleado fuera del alcance del encargado', async () => {
    await expect(gestion.resumen(20, 99)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect((await gestion.resumen(20, 10)).idEmpleado).toBe(10);
  });
  it('rechaza solicitudes anteriores o cruzadas con el corte', async () => {
    tablas.periodos[0].fechaCorteInicial = '2026-10-07';
    await expect(solicitudes.aprobar(1, 30, {})).rejects.toThrow(/corte/);
    expect(tablas.movimientos).toHaveLength(0);
  });
  it('bloquea historia sin conciliar y luego descuenta el corte sin duplicar septiembre', async () => {
    tablas.periodos = [{
      idPeriodo: 1, idEmpleado: 10, fechaInicio: '2026-01-01', fechaFin: '2026-12-31',
      fechaCorteInicial: '2026-01-01', diasAsignados: '15.00', diasUtilizadosIniciales: '4.00',
    }];
    tablas.solicitudes = [
      { ...tablas.solicitudes[0], idSolicitud: 2, estado: 'APROBADA', fechaInicio: '2026-09-21', fechaFin: '2026-09-25', diasSolicitados: 5 },
      { ...tablas.solicitudes[0], idSolicitud: 4, estado: 'PENDIENTE', fechaInicio: '2026-10-19', fechaFin: '2026-10-23', diasSolicitados: 5 },
    ];
    expect((await gestion.resumen(10)).requiereConciliacion).toBe(true);
    await expect(saldo.validarDisponibilidad(manager, 10)).rejects.toBeInstanceOf(ConflictException);
    tablas.periodos[0].diasUtilizadosIniciales = '9.00';
    tablas.periodos[0].fechaCorteInicial = '2026-09-25';
    expect(await gestion.resumen(10)).toMatchObject({
      requiereConciliacion: false, saldoTotal: '6.00', diasReservados: '5.00', diasDisponibles: '1.00',
    });
    await expect(saldo.validarDisponibilidad(manager, 10, {
      idSolicitud: 5, fechaInicio: '2026-11-02', fechaFin: '2026-11-06', diasSolicitados: 5,
    })).rejects.toThrow(/insuficiente/);
    expect(tablas.movimientos).toHaveLength(0);
  });
  it('detecta aprobadas antiguas sin descontarlas', async () => {
    tablas.solicitudes[0].estado = 'APROBADA';
    expect((await gestion.resumen(10)).requiereConciliacion).toBe(true);
    expect(tablas.movimientos).toHaveLength(0);
    await expect(
      solicitudes.cancelar(1, {
        idUsuario: 10,
        idEmpleado: 10,
        nivelJerarquico: 1,
      }),
    ).rejects.toThrow(/históricas/);
  });
  it('reconoce historia cubierta por todos los cortes sin crear movimientos', async () => {
    tablas.solicitudes[0] = {
      ...tablas.solicitudes[0],
      estado: 'APROBADA',
      fechaInicio: '2025-10-06',
      fechaFin: '2025-10-10',
    };
    expect((await gestion.resumen(10)).requiereConciliacion).toBe(false);
    expect(tablas.movimientos).toHaveLength(0);
  });
  it('impide solapamientos con aprobadas', async () => {
    tablas.solicitudes.push({ ...tablas.solicitudes[0], idSolicitud: 2 });
    await expect(solicitudes.editar(1, 10, dto)).rejects.toThrow(
      /superpuestas/,
    );
  });
  it('impide solapamiento de períodos y cambios iniciales con movimientos', async () => {
    const p = {
      fechaInicio: '2024-06-01',
      fechaFin: '2025-02-01',
      diasAsignados: '5.00',
      diasUtilizadosIniciales: '0.00',
    };
    await expect(gestion.guardarPeriodo(30, 10, p)).rejects.toThrow(
      /superpone/,
    );
    await solicitudes.aprobar(1, 30, {});
    await expect(
      gestion.guardarPeriodo(
        30,
        10,
        { ...tablas.periodos[0], diasAsignados: '20.00' },
        1,
      ),
    ).rejects.toThrow(/movimientos/);
  });
  it('ajuste negativo no evade reservas y rollback no deja movimientos', async () => {
    await expect(
      gestion.ajustar(30, 10, 2, {
        tipoMovimiento: 'AJUSTE_NEGATIVO',
        dias: '4.00',
        motivo: 'Corrección',
      }),
    ).rejects.toThrow(/insuficiente/);
    expect(tablas.movimientos).toHaveLength(0);
  });
  it('administrador sin empleado no puede inventar el registrador', async () => {
    await expect(
      gestion.ajustar(40, 10, 1, {
        tipoMovimiento: 'AJUSTE_POSITIVO',
        dias: '1.00',
        motivo: 'Corrección',
      }),
    ).rejects.toThrow(/empleado activo asociado/);
    expect(tablas.movimientos).toHaveLength(0);
  });
  it('una baja lógica histórica exige conciliación', async () => {
    tablas.solicitudes[0].isActive = false;
    expect((await gestion.resumen(10)).requiereConciliacion).toBe(true);
  });
  it('no compensa períodos negativos con otros positivos', async () => {
    tablas.movimientos.push({
      idMovimiento: 1,
      idPeriodo: 1,
      idSolicitud: null,
      tipoMovimiento: 'AJUSTE_NEGATIVO',
      dias: '4.00',
    });
    await expect(solicitudes.aprobar(1, 30, {})).rejects.toThrow(/conciliar/);
  });
  it('valida fechas reales y usa centésimas exactas', () => {
    expect(() => fechaCalendario('2026-02-30')).toThrow();
    expect(() => fechaCalendario('2026-10-05T00:00:00Z')).toThrow();
    expect(decimal(centesimas('0.10') + centesimas('0.20'))).toBe('0.30');
    expect(() => centesimas('0.001')).toThrow();
    expect(() =>
      asignarReservas(
        [],
        [
          {
            idSolicitud: 0,
            fechaInicio: '2026-10-06',
            fechaFin: '2026-10-05',
            diasSolicitados: 1,
          },
        ],
      ),
    ).toThrow();
  });
});
