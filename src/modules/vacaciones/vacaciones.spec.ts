import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Brackets } from 'typeorm';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { Empleado } from '../organization/empleados/entities/empleado.entity';
import { SolicitudIncidencia } from '../solicitudes/entities/solicitud-incidencia.entity';
import { VacacionesController } from './vacaciones.controller';
import { fechaActualGuatemala, VacacionesService } from './vacaciones.service';

describe('Vacaciones: consultas y seguridad HTTP', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const qb: any = {};
  const empleados = { findOne: jest.fn() };
  const solicitudes = { createQueryBuilder: jest.fn(() => qb) };
  const methods = ['innerJoinAndSelect', 'select', 'where', 'andWhere', 'orderBy', 'addOrderBy'];

  beforeAll(async () => {
    methods.forEach(m => { qb[m] = jest.fn().mockReturnValue(qb); });
    qb.getMany = jest.fn();
    const module = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: 'vacaciones-test-only' })],
      controllers: [VacacionesController],
      providers: [VacacionesService, JwtStrategy,
        { provide: ConfigService, useValue: { get: () => 'vacaciones-test-only' } },
        { provide: getRepositoryToken(Empleado), useValue: empleados },
        { provide: getRepositoryToken(SolicitudIncidencia), useValue: solicitudes },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true,
      transform: true, transformOptions: { enableImplicitConversion: true } }));
    await app.init();
    jwt = module.get(JwtService);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    empleados.findOne.mockResolvedValue({ idEmpleado: 22 });
    qb.getMany.mockResolvedValue([]);
  });
  afterAll(async () => { await app.close(); });
  const get = (path: string, payload: object = { sub: 1, idEmpleado: 22 }) =>
    request(app.getHttpServer()).get(`/vacaciones/${path}`)
      .set('Authorization', `Bearer ${jwt.sign(payload)}`);

  it.each(['mis-vacaciones', 'proximas', 'historial'])('rechaza acceso sin JWT: %s', async path => {
    await request(app.getHttpServer()).get(`/vacaciones/${path}`).expect(401);
    expect(solicitudes.createQueryBuilder).not.toHaveBeenCalled();
  });
  it('rechaza JWT invalido', async () => {
    await request(app.getHttpServer()).get('/vacaciones/proximas')
      .set('Authorization', 'Bearer invalido').expect(401);
  });
  it.each([undefined, null, 0, -1, '22', 1.5])('rechaza empleado invalido %s', async idEmpleado => {
    await get('mis-vacaciones', { sub: 1, idEmpleado }).expect(403);
    expect(solicitudes.createQueryBuilder).not.toHaveBeenCalled();
  });
  it('rechaza empleado inexistente o inactivo', async () => {
    empleados.findOne.mockResolvedValue(null);
    await get('proximas').expect(403);
  });
  it.each(['mis-vacaciones', 'proximas', 'historial'])('no acepta otro empleado por query: %s', async path => {
    await get(`${path}?idEmpleado=99`).expect(400);
    expect(solicitudes.createQueryBuilder).not.toHaveBeenCalled();
  });
  it.each(['abc', '2026.5', '0', '10000'])('valida anio %s', async anio => {
    await get(`mis-vacaciones?anio=${anio}`).expect(400);
  });
  it('agrupa todos los estados y limita la consulta al empleado del JWT', async () => {
    qb.getMany.mockResolvedValue(['PENDIENTE', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'CANCELADA']
      .map((estado, i) => ({ idSolicitud: i + 1, estado, fechaInicio: '2026-12-28',
        fechaFin: '2027-01-04', diasSolicitados: 5, motivo: 'Descanso',
        tipoIncidencia: { nombre: 'Descanso anual' } })));
    const { body } = await get('mis-vacaciones?anio=2026').expect(200);
    expect(body.pendientes).toHaveLength(2);
    expect(body.aprobadas).toHaveLength(1);
    expect(body.rechazadas).toHaveLength(1);
    expect(body.canceladas).toHaveLength(1);
    expect(body.aprobadas[0]).toMatchObject({ nombreTipo: 'Descanso anual', diasSolicitados: 5 });
    expect(qb.where).toHaveBeenCalledWith('solicitud.idEmpleado = :idEmpleado', { idEmpleado: 22 });
    expect(qb.andWhere).toHaveBeenCalledWith('solicitud.isActive = :activa', { activa: true });
    expect(qb.andWhere).toHaveBeenCalledWith('tipo.descuentaVacaciones = :descuenta', { descuenta: true });
    expect(qb.andWhere).toHaveBeenCalledWith('COALESCE(solicitud.fechaInicio, solicitud.fechaFin) <= :finAnio', { finAnio: '2026-12-31' });
    expect(qb.andWhere).toHaveBeenCalledWith('COALESCE(solicitud.fechaFin, solicitud.fechaInicio) >= :inicioAnio', { inicioAnio: '2026-01-01' });
  });
  it('proximas exige aprobacion y fecha desde hoy', async () => {
    await get('proximas').expect(200, []);
    expect(qb.andWhere).toHaveBeenCalledWith('solicitud.estado = :estado', { estado: 'APROBADA' });
    expect(qb.andWhere).toHaveBeenCalledWith('solicitud.fechaInicio >= :hoy', { hoy: fechaActualGuatemala() });
    expect(qb.orderBy).toHaveBeenCalledWith('solicitud.fechaInicio', 'ASC');
  });
  it('historial mantiene las alternativas dentro de parentesis', async () => {
    await get('historial?anio=2026').expect(200, { anio: 2026, solicitudes: [] });
    const bracket = qb.andWhere.mock.calls.find(([v]: any[]) => v instanceof Brackets)?.[0];
    expect(bracket).toBeInstanceOf(Brackets);
    const inner = { where: jest.fn(), orWhere: jest.fn() };
    inner.where.mockReturnValue(inner); inner.orWhere.mockReturnValue(inner);
    bracket.whereFactory(inner);
    expect(inner.orWhere).toHaveBeenCalledWith('solicitud.estado IN (:...resueltas)', {
      resueltas: ['APROBADA', 'RECHAZADA', 'CANCELADA'],
    });
  });
  it('calcula hoy con la fecha de Guatemala incluso al cambiar de anio UTC', () => {
    expect(fechaActualGuatemala(new Date('2026-01-01T03:00:00Z'))).toBe('2025-12-31');
  });
});
