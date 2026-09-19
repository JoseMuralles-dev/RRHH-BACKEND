import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../jwt/jwt-auth.guard';
import { UserController } from '../../../modules/user/user.controller';
import { UsuariosService } from '../../../modules/user/user.service';
import { EmpleadosController } from '../../../modules/organization/empleados/empleados.controller';
import { EmpleadosService } from '../../../modules/organization/empleados/empleados.service';

// Estas pruebas ejercitan autorización; el DTO usa una dependencia ESM ajena al guard.
jest.mock('../../../modules/organization/empleados/dto/update-empleado.dto', () => ({
  UpdateEmpleadoDto: class {},
}));

describe('Permisos de administración por HTTP', () => {
  let app: INestApplication;
  const servicio = { findAll: jest.fn(() => []), create: jest.fn(() => ({})), update: jest.fn(() => ({})) };
  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [UserController, EmpleadosController],
      providers: [
        { provide: UsuariosService, useValue: servicio },
        { provide: EmpleadosService, useValue: servicio },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate(context) {
      const req = context.switchToHttp().getRequest();
      req.user = { nivelJerarquico: Number(req.headers['x-nivel']) };
      return true;
    } }).compile();
    app = modulo.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it.each([1, 2, 3])('bloquea Usuarios al nivel %i', async nivel => {
    await request(app.getHttpServer()).get('/user').set('x-nivel', String(nivel)).expect(403);
    await request(app.getHttpServer()).post('/user').set('x-nivel', String(nivel)).send({}).expect(403);
    await request(app.getHttpServer()).patch('/user/1').set('x-nivel', String(nivel)).send({}).expect(403);
  });
  it('permite Usuarios al administrador', async () => {
    await request(app.getHttpServer()).get('/user').set('x-nivel', '4').expect(200);
    await request(app.getHttpServer()).post('/user').set('x-nivel', '4').send({}).expect(201);
    await request(app.getHttpServer()).patch('/user/1').set('x-nivel', '4').send({}).expect(200);
  });
  it.each([1, 2])('bloquea Empleados al nivel %i', async nivel => {
    await request(app.getHttpServer()).get('/empleados').set('x-nivel', String(nivel)).expect(403);
    await request(app.getHttpServer()).post('/empleados').set('x-nivel', String(nivel)).send({}).expect(403);
    await request(app.getHttpServer()).patch('/empleados/1').set('x-nivel', String(nivel)).send({}).expect(403);
  });
  it.each([3, 4])('permite listar, crear y editar empleados al nivel %i', async nivel => {
    await request(app.getHttpServer()).get('/empleados').set('x-nivel', String(nivel)).expect(200);
    await request(app.getHttpServer()).post('/empleados').set('x-nivel', String(nivel)).send({}).expect(201);
    await request(app.getHttpServer()).patch('/empleados/1').set('x-nivel', String(nivel)).send({}).expect(200);
  });
  it('rechaza niveles inválidos', async () => {
    await request(app.getHttpServer()).get('/user').set('x-nivel', 'invalido').expect(403);
  });
});
