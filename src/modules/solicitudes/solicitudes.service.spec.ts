import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SolicitudesService } from './solicitudes.service';
import { SolicitudIncidencia } from './entities/solicitud-incidencia.entity';
import { AprobacionIncidencia } from './entities/aprobacion-incidencia.entity';
import { TipoIncidencia } from './entities/tipo-incidencia.entity';
import { Empleado } from '../organization/empleados/entities/empleado.entity';
import { Usuario } from '../user/entities/user.entity';
import { EstadoSolicitud as S } from './enums/estado-solicitud.enum';
import { EstadoAprobacion as A } from './enums/estado-aprobacion.enum';
import { validarPeriodo } from './solicitud-reglas';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';

describe('Solicitudes: flujo de aprobación', () => {
  let service: SolicitudesService;
  let solicitud: any;
  let aprobaciones: any[];
  const solicitudes = { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn() };
  const aprobacionRepo = { find: jest.fn(), create: jest.fn(), save: jest.fn() };
  const empleados = { findOne: jest.fn() };
  const usuarios = { findOne: jest.fn(), find: jest.fn() };
  const tipos = { findOne: jest.fn(), find: jest.fn() };
  const manager = { getRepository: jest.fn() };
  const transaction = jest.fn();
  const dto = { idTipoIncidencia: 1, fechaInicio: '2026-09-17', fechaFin: '2026-09-18', diasSolicitados: 2, motivo: ' Asunto personal ' };

  beforeEach(() => {
    jest.resetAllMocks();
    solicitud = { idSolicitud: 1, idEmpleado: 10, estado: S.PENDIENTE, isActive: true };
    aprobaciones = [
      { idAprobacion: 1, idSolicitud: 1, idUsuarioAprobador: 20, nivelAprobacion: 1, estado: A.PENDIENTE },
      { idAprobacion: 2, idSolicitud: 1, idUsuarioAprobador: 30, nivelAprobacion: 2, estado: A.PENDIENTE },
    ];
    manager.getRepository.mockImplementation(entity => {
      if (entity === SolicitudIncidencia) return solicitudes;
      if (entity === AprobacionIncidencia) return aprobacionRepo;
      if (entity === Empleado) return empleados;
      if (entity === Usuario) return usuarios;
      if (entity === TipoIncidencia) return tipos;
      throw new Error('Repositorio inesperado');
    });
    transaction.mockImplementation((...args) => args.at(-1)(manager));
    solicitudes.findOne.mockImplementation(async () => solicitud);
    solicitudes.create.mockImplementation(data => data);
    solicitudes.save.mockImplementation(async data => ({ ...data, idSolicitud: 1 }));
    aprobacionRepo.find.mockImplementation(async () => aprobaciones);
    aprobacionRepo.create.mockImplementation(data => data);
    aprobacionRepo.save.mockImplementation(async data => data);
    usuarios.findOne.mockImplementation(async ({ where }) => ({ idUsuario: where.idUsuario, idEmpleado: where.idUsuario }));
    usuarios.find.mockResolvedValue([{ idUsuario: 30, idEmpleado: 30 }]);
    empleados.findOne.mockResolvedValue({ idEmpleado: 10, isActive: true, jefeDirecto: {
      idEmpleado: 20, isActive: true, usuario: { idUsuario: 20, isActive: true, estado: 'ACTIVO', rol: { isActive: true } },
    } });
    tipos.findOne.mockResolvedValue({ idTipoIncidencia: 1, isActive: true, requierePeriodo: true });
    service = new SolicitudesService(solicitudes as unknown as Repository<SolicitudIncidencia>,
      tipos as unknown as Repository<TipoIncidencia>, aprobacionRepo as unknown as Repository<AprobacionIncidencia>,
      empleados as unknown as Repository<Empleado>, usuarios as unknown as Repository<Usuario>,
      { transaction } as unknown as DataSource);
  });

  it('creates material requests without dates or days', async () => {
    tipos.findOne.mockResolvedValue({ idTipoIncidencia: 2, isActive: true, requierePeriodo: false });
    const result = await service.create(10, { idTipoIncidencia: 2, motivo: 'Solicito materiales' });
    expect(result).toEqual(expect.objectContaining({ fechaInicio: null, fechaFin: null, diasSolicitados: null }));
    expect(aprobacionRepo.save).toHaveBeenCalled();
  });

  it('requires the complete period for vacation and rest types', async () => {
    await expect(service.create(10, { idTipoIncidencia: 1, motivo: 'Vacaciones' })).rejects.toBeInstanceOf(BadRequestException);
    expect(solicitudes.save).not.toHaveBeenCalled();
  });

  it('rejects period fields for material types, regardless of client input', async () => {
    tipos.findOne.mockResolvedValue({ idTipoIncidencia: 2, isActive: true, requierePeriodo: false });
    await expect(service.create(10, dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(solicitudes.save).not.toHaveBeenCalled();
  });

  it('creates the request and two separate approval levels in one transaction', async () => {
    const result = await service.create(10, dto);
    expect(result.motivo).toBe('Asunto personal');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(aprobacionRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ idUsuarioAprobador: 20, nivelAprobacion: 1 }),
      expect.objectContaining({ idUsuarioAprobador: 30, nivelAprobacion: 2 }),
    ]);
  });

  it('assigns only the direct boss when their active role is RRHH', async () => {
    const empleado = await empleados.findOne();
    empleado.jefeDirecto.usuario.rol.codigoRol = 'RRHH';
    usuarios.find.mockResolvedValue([]);
    await service.create(10, dto);
    expect(usuarios.find).not.toHaveBeenCalled();
    expect(aprobacionRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ idUsuarioAprobador: 20, nivelAprobacion: 1 }),
    ]);
  });

  it('shows a single approval in the assigned inbox and completes it directly', async () => {
    aprobaciones = [aprobaciones[0]];
    aprobacionRepo.find.mockResolvedValueOnce([{ ...aprobaciones[0], solicitud: { ...solicitud, aprobaciones } }]);
    expect(await service.findPendientesAprobacion(20)).toHaveLength(1);
    await expect(service.aprobar(1, 99, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect((await service.aprobar(1, 20, {})).estado).toBe(S.APROBADA);
    expect(solicitud.fechaResolucion).toBeInstanceOf(Date);
    await expect(service.aprobar(1, 20, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('closes a single approval on rejection', async () => {
    aprobaciones = [aprobaciones[0]];
    expect((await service.rechazar(1, 20, { comentario: 'No procede' })).estado).toBe(S.RECHAZADA);
    expect(solicitud.fechaResolucion).toBeInstanceOf(Date);
  });

  it.each([null, { isActive: false }, { isActive: true, idEmpleado: 10 },
    { isActive: true, idEmpleado: 20, usuario: { isActive: false } },
    { isActive: true, idEmpleado: 20, usuario: { isActive: true, estado: 'BLOQUEADO' } },
  ])('rejects unusable or self-assigned bosses: %j', async jefeDirecto => {
    empleados.findOne.mockResolvedValue({ idEmpleado: 10, jefeDirecto });
    await expect(service.create(10, dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(solicitudes.save).not.toHaveBeenCalled();
  });

  it('rejects RRHH candidates who are the requester or boss', async () => {
    usuarios.find.mockResolvedValue([{ idUsuario: 10, idEmpleado: 10 }, { idUsuario: 20, idEmpleado: 20 }]);
    await expect(service.create(10, dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(solicitudes.save).not.toHaveBeenCalled();
  });

  it('approves boss then RRHH, locking the same request each time', async () => {
    expect((await service.aprobar(1, 20, {})).estado).toBe(S.EN_REVISION);
    expect((await service.aprobar(1, 30, {})).estado).toBe(S.APROBADA);
    expect(solicitud.fechaResolucion).toBeInstanceOf(Date);
    expect(solicitudes.findOne).toHaveBeenCalledWith({ where: { idSolicitud: 1, isActive: true }, lock: { mode: 'pessimistic_write' } });
    expect(transaction).toHaveBeenCalledWith('READ COMMITTED', expect.any(Function));
  });

  it.each(['aprobar', 'rechazar'] as const)('does not let RRHH %s before the boss', async action => {
    await expect(service[action](1, 30, { comentario: 'Motivo' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(solicitudes.save).not.toHaveBeenCalled();
  });

  it.each([S.CANCELADA, S.RECHAZADA, S.APROBADA])('cannot change a closed request: %s', async estado => {
    solicitud.estado = estado;
    await expect(service.aprobar(1, 20, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.rechazar(1, 20, { comentario: 'Motivo' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.cancelar(1, { idEmpleado: 10, nivelJerarquico: 1 })).rejects.toBeInstanceOf(BadRequestException);
    expect(solicitudes.save).not.toHaveBeenCalled();
  });

  it('rejects with a trimmed explanation and closes the request', async () => {
    await expect(service.rechazar(1, 20, { comentario: '  ' })).rejects.toBeInstanceOf(BadRequestException);
    expect((await service.rechazar(1, 20, { comentario: ' No procede ' })).estado).toBe(S.RECHAZADA);
    expect(aprobaciones[0].comentario).toBe('No procede');
  });

  it('requires the assigned active approver and prevents self-approval', async () => {
    await expect(service.aprobar(1, 99, {})).rejects.toBeInstanceOf(ForbiddenException);
    usuarios.findOne.mockResolvedValue({ idUsuario: 20, idEmpleado: 10 });
    await expect(service.aprobar(1, 20, {})).rejects.toBeInstanceOf(ForbiddenException);
    usuarios.findOne.mockResolvedValue(null);
    await expect(service.aprobar(1, 20, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('only the owner or administrator can cancel, under the same row lock', async () => {
    await expect(service.cancelar(1, { idEmpleado: 99, nivelJerarquico: 2 })).rejects.toBeInstanceOf(ForbiddenException);
    expect((await service.cancelar(1, { idEmpleado: 10, nivelJerarquico: 1 })).estado).toBe(S.CANCELADA);
    expect(solicitudes.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
  });

  it('reports a missing request without saving', async () => {
    solicitudes.findOne.mockResolvedValue(null);
    await expect(service.aprobar(1, 20, {})).rejects.toBeInstanceOf(NotFoundException);
    expect(solicitudes.save).not.toHaveBeenCalled();
  });

  it('filters closed requests in the query and hides RRHH until the boss approves', async () => {
    const rrhh = { ...aprobaciones[1], solicitud: { ...solicitud, aprobaciones } };
    aprobacionRepo.find.mockResolvedValue([rrhh]);
    expect(await service.findPendientesAprobacion(30)).toEqual([]);
    expect(aprobacionRepo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ solicitud: { isActive: true, estado: expect.anything() } }),
    }));
    aprobaciones[0].estado = A.APROBADA;
    expect(await service.findPendientesAprobacion(30)).toEqual([rrhh]);
    aprobaciones[0].estado = A.RECHAZADA;
    expect(await service.findPendientesAprobacion(30)).toEqual([]);
  });

  it('lists only this users approved decisions, including requests awaiting RRHH', async () => {
    const approved = { ...aprobaciones[0], estado: A.APROBADA, solicitud: { ...solicitud, estado: S.EN_REVISION } };
    aprobacionRepo.find.mockResolvedValue([approved]);
    expect(await service.findAprobadas(20)).toEqual([approved]);
    expect(aprobacionRepo.find).toHaveBeenCalledWith({
      where: { idUsuarioAprobador: 20, estado: A.APROBADA, solicitud: { isActive: true } },
      relations: { solicitud: { empleado: true, tipoIncidencia: true, aprobaciones: true } },
      order: { fechaRespuesta: 'DESC', idAprobacion: 'DESC' },
    });
  });

  it('returns only active incidence types ordered by name', async () => {
    tipos.find.mockResolvedValue([{ idTipoIncidencia: 1, nombre: 'Permiso' }]);
    expect(await service.findTiposIncidencia()).toHaveLength(1);
    expect(tipos.find).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true }, order: { nombre: 'ASC' } }));
  });

  it('serializes competing approve/cancel operations using a simulated row lock', async () => {
    // Models database transaction serialization; this is not a live MySQL integration test.
    let cola: Promise<unknown> = Promise.resolve();
    transaction.mockImplementation((...args) => {
      const siguiente = cola.then(() => args.at(-1)(manager));
      cola = siguiente.catch(() => {});
      return siguiente;
    });
    const results = await Promise.allSettled([
      service.cancelar(1, { idEmpleado: 10, nivelJerarquico: 1 }), service.aprobar(1, 20, {}),
    ]);
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'rejected']);
    expect(solicitud.estado).toBe(S.CANCELADA);
    expect(aprobacionRepo.save).not.toHaveBeenCalled();
  });
});

describe('Validaciones de fechas y días', () => {
  it.each([
    ['2026-09-17', '2026-09-17', 100], ['2026-09-18', '2026-09-17', 1],
    ['2026-02-30', '2026-03-01', 1], ['2026-09-17T12:00:00Z', '2026-09-18', 1],
    ['2026-09-17', '2026-09-18', 0], ['2026-09-17', '2026-09-18', 1.5],
    ['2026-09-17', '2026-09-18', 1], ['2026-09-19', '2026-09-20', 1],
  ])('rejects %s / %s / %s', (inicio, fin, dias) => {
    expect(() => validarPeriodo(inicio as string, fin as string, dias as number)).toThrow(BadRequestException);
  });
  it('counts Monday-Friday inclusively, including leap days but not weekends', () => {
    expect(() => validarPeriodo('2024-02-28', '2024-03-01', 3)).not.toThrow();
    expect(() => validarPeriodo('2026-09-17', '2026-09-20', 2)).not.toThrow();
    expect(validarPeriodo('2026-09-18', '2026-09-21', 2)).toBe(2);
    expect(validarPeriodo('2026-09-14', '2026-09-27', 10)).toBe(10);
    expect(validarPeriodo('2026-09-21', '2026-09-21', 1)).toBe(1);
  });
  it('rejects blank reasons and timestamps in the request DTO', async () => {
    const dto = plainToInstance(CreateSolicitudDto, { idTipoIncidencia: 1, fechaInicio: '2026-09-17T12:00:00Z',
      fechaFin: '2026-09-18', diasSolicitados: 1, motivo: '   ' });
    expect((await validate(dto)).map(e => e.property)).toEqual(expect.arrayContaining(['fechaInicio', 'motivo']));
  });
});
