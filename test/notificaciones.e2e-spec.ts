import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { Usuario } from '../src/modules/user/entities/user.entity';
import { NotificacionesController } from '../src/modules/notificaciones/notificaciones.controller';
import { NotificacionesService } from '../src/modules/notificaciones/notificaciones.service';

// HTTP, validacion, bcrypt, JWT y servicios reales; persistencia en memoria.
// No importa AppModule ni carga .env, MySQL o SAP.
describe('Integracion HTTP: login y notificaciones', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let usuario: any;
  let rows: any[];
  let hash: string;
  const query = {
    addSelect: jest.fn().mockReturnThis(), leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(async () => usuario),
  };
  const matches = (row: any, where: object) => Object.entries(where).every(([key, value]) => row[key] === value);
  const repo = {
    find: jest.fn(async ({ where }) => rows.filter(row => matches(row, where))),
    count: jest.fn(async ({ where }) => rows.filter(row => matches(row, where)).length),
    findOne: jest.fn(async ({ where }) => rows.find(row => matches(row, where)) ?? null),
    update: jest.fn(async (where, values) => {
      const targets = rows.filter(row => matches(row, where));
      targets.forEach(row => Object.assign(row, values));
      return { affected: targets.length };
    }),
  };
  beforeAll(async () => {
    hash = await bcrypt.hash('Test-password-123!', 4);
    const module = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: 'http-integration-test-only' })],
      controllers: [AuthController, NotificacionesController],
      providers: [AuthService, JwtStrategy, NotificacionesService,
        { provide: ConfigService, useValue: { get: () => 'http-integration-test-only' } },
        { provide: getRepositoryToken(Usuario), useValue: { createQueryBuilder: () => query } },
        { provide: DataSource, useValue: { getRepository: () => repo } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    jwt = module.get(JwtService);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    usuario = { idUsuario: 1, correo: 'test@example.com', passwordHash: hash,
      estado: 'ACTIVO', idEmpleado: 10, idRol: 1, rol: { codigoRol: 'EMPLEADO', nivelJerarquico: 1, isActive: true } };
    rows = [1, 1, 2].map((idUsuarioDestinatario, index) => ({
      idNotificacion: index + 1, idUsuarioDestinatario, leida: false,
      fechaLectura: null, isActive: true, titulo: 'Solicitud', mensaje: 'Prueba', createdAt: new Date('2026-10-01'),
    }));
  });
  afterAll(async () => { await app?.close(); });
  const token = (sub = 1) => `Bearer ${jwt.sign({ sub, nivelJerarquico: 1 })}`;
  const login = (password = 'Test-password-123!') => request(app.getHttpServer()).post('/auth/login')
    .send({ correo: 'test@example.com', password });

  it('usa el JWT emitido por login para consultar solo las notificaciones propias', async () => {
    const response = await login().expect(200);
    expect(response.body.usuario).not.toHaveProperty('passwordHash');
    expect(jwt.verify(response.body.access_token).sub).toBe(1);
    const bandeja = await request(app.getHttpServer()).get('/notificaciones/mias')
      .set('Authorization', `Bearer ${response.body.access_token}`).expect(200);
    expect(bandeja.body.map(n => n.idNotificacion)).toEqual([1, 2]);
  });
  it('rechaza password incorrecto sin emitir token', async () => {
    const { body } = await login('incorrecto').expect(401);
    expect(body).not.toHaveProperty('access_token');
  });
  it('valida el payload antes de consultar usuarios', async () => {
    await request(app.getHttpServer()).post('/auth/login')
      .send({ correo: 'no-es-correo', password: '', nivelJerarquico: 4 }).expect(400);
    expect(query.getOne).not.toHaveBeenCalled();
  });
  it.each(['BLOQUEADO', 'INACTIVO'])('rechaza el usuario %s', async estado => {
    usuario.estado = estado;
    await login().expect(401);
  });
  it('rechaza rol inactivo aunque la password sea correcta', async () => {
    usuario.rol.isActive = false;
    await login().expect(401);
  });
  it('rechaza usuario inexistente y rol ausente', async () => {
    usuario = null;
    await login().expect(401);
    usuario = { estado: 'ACTIVO', passwordHash: hash, rol: null };
    await login().expect(401);
  });
  it.each([undefined, 'Bearer invalido'])('rechaza acceso sin token valido: %s', async auth => {
    const req = request(app.getHttpServer()).get('/notificaciones/mias');
    if (auth) req.set('Authorization', auth);
    await req.expect(401);
    expect(repo.find).not.toHaveBeenCalled();
  });
  it('rechaza JWT expirado', async () => {
    await request(app.getHttpServer()).get('/notificaciones/mias')
      .set('Authorization', `Bearer ${jwt.sign({ sub: 1 }, { expiresIn: -1 })}`).expect(401);
  });
  it('marca una notificacion y actualiza contador sin repetir su fecha', async () => {
    const primera = await request(app.getHttpServer()).patch('/notificaciones/1/leida')
      .set('Authorization', token()).expect(200);
    const segunda = await request(app.getHttpServer()).patch('/notificaciones/1/leida')
      .set('Authorization', token()).expect(200);
    expect(segunda.body.fechaLectura).toBe(primera.body.fechaLectura);
    await request(app.getHttpServer()).get('/notificaciones/no-leidas/count')
      .set('Authorization', token()).expect(200, { noLeidas: 1 });
  });
  it('no modifica la notificacion ajena', async () => {
    await request(app.getHttpServer()).patch('/notificaciones/3/leida')
      .set('Authorization', token()).expect(404);
    expect(rows[2].leida).toBe(false);
  });
  it('marca todas solo del destinatario y repetir no vuelve a modificarlas', async () => {
    for (const actualizadas of [2, 0]) {
      await request(app.getHttpServer()).patch('/notificaciones/marcar-todas/leidas')
        .set('Authorization', token()).expect(200, { actualizadas });
    }
    expect(rows[2].leida).toBe(false);
  });
  it('rechaza un identificador mal formado', async () => {
    await request(app.getHttpServer()).patch('/notificaciones/abc/leida')
      .set('Authorization', token()).expect(400);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
