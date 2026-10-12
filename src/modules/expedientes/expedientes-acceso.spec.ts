import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { ExpedientesController } from './controllers/expedientes.controller';
import { ExpedientesService } from './services/expedientes.service';

describe('Expediente propio: lectura y permisos HTTP', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const expediente = { idExpediente: 5, idEmpleado: 10, isActive: true, documentos: [] };
  const expedientes = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const documentos = { findOne: jest.fn() };
  const empleados = { findOne: jest.fn() };
  const storage = { leerArchivo: jest.fn() };
  const service = new ExpedientesService(expedientes as any, documentos as any, {} as any, empleados as any, storage as any);
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: 'expedientes-tests-only' })],
      controllers: [ExpedientesController],
      providers: [JwtStrategy, { provide: ConfigService, useValue: { get: () => 'expedientes-tests-only' } },
        { provide: ExpedientesService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    jwt = module.get(JwtService);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    empleados.findOne.mockResolvedValue({ idEmpleado: 10 });
    expedientes.findOne.mockImplementation(async ({ where }) =>
      Object.entries(where).every(([key, value]) => expediente[key] === value) ? expediente : null);
    documentos.findOne.mockResolvedValue({ nombreOriginal: 'propio.pdf', mimeType: 'application/pdf', rutaArchivo: 'simulado' });
    storage.leerArchivo.mockResolvedValue(Buffer.from('documento de prueba'));
  });
  afterAll(async () => { await app?.close(); });
  const auth = (nivelJerarquico = 1, idEmpleado: number | null = 10) =>
    `Bearer ${jwt.sign({ sub: 1, nivelJerarquico, idEmpleado })}`;

  it('permite consultar el expediente propio', async () => {
    await request(app.getHttpServer()).get('/expedientes/empleado/10').set('Authorization', auth()).expect(200);
  });
  it.each([1, 2])('impide editar y desactivar al nivel %s', async nivel => {
    await request(app.getHttpServer()).patch('/expedientes/documentos/1').set('Authorization', auth(nivel)).send({ observaciones: 'Cambio' }).expect(403);
    await request(app.getHttpServer()).delete('/expedientes/documentos/1').set('Authorization', auth(nivel)).expect(403);
  });
  it('rechaza consultar otro empleado cambiando la URL', async () => {
    await request(app.getHttpServer()).get('/expedientes/empleado/20').set('Authorization', auth()).expect(403);
  });
  it.each(['descargar', 'previsualizar'])('permite %s solo del expediente propio', async accion => {
    await request(app.getHttpServer()).get('/expedientes/5/documentos/1/' + accion).set('Authorization', auth()).expect(200);
    storage.leerArchivo.mockClear();
    await request(app.getHttpServer()).get('/expedientes/6/documentos/1/' + accion).set('Authorization', auth()).expect(403);
    expect(storage.leerArchivo).not.toHaveBeenCalled();
  });
  it('rechaza crear y subir documentos aunque se invoque directamente la API', async () => {
    await request(app.getHttpServer()).post('/expedientes').set('Authorization', auth()).send({ idEmpleado: 10 }).expect(403);
    await request(app.getHttpServer()).post('/expedientes/5/documentos').set('Authorization', auth())
      .attach('archivo', Buffer.from('prueba'), { filename: 'prueba.pdf', contentType: 'application/pdf' }).expect(403);
    expect(expedientes.create).not.toHaveBeenCalled();
  });
  it.each([3, 4])('permite al nivel %s consultar otro empleado sin empleado propio', async nivel => {
    await request(app.getHttpServer()).get('/expedientes/empleado/10').set('Authorization', auth(nivel, null)).expect(200);
  });
  it('rechaza usuarios sin empleado, empleados inactivos y peticiones anonimas', async () => {
    await request(app.getHttpServer()).get('/expedientes/empleado/10').set('Authorization', auth(1, null)).expect(403);
    empleados.findOne.mockResolvedValue(null);
    await request(app.getHttpServer()).get('/expedientes/empleado/10').set('Authorization', auth()).expect(403);
    await request(app.getHttpServer()).get('/expedientes/empleado/10').expect(401);
  });
});
