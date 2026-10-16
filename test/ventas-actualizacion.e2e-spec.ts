import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { VentasController } from '../src/modules/kpi/ventas/ventas.controller';
import { VentasService } from '../src/modules/kpi/ventas/ventas.service';
import { JwtAuthGuard } from '../src/common/guards/jwt/jwt-auth.guard';

// Integracion HTTP de DTO/guards/rutas. SAP y persistencia se cubren en pruebas
// del servicio; este test no abre conexiones a produccion ni usa credenciales.
describe('Ventas actualizacion HTTP', () => {
  let app: INestApplication;
  const ventas = { actualizar: jest.fn(), avance: jest.fn() };
  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [VentasController], providers: [{ provide: VentasService, useValue: ventas }],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate(ctx: any) {
      const req = ctx.switchToHttp().getRequest();
      if (!req.headers['x-test-level']) throw new UnauthorizedException();
      req.user = { idUsuario: 7, nivelJerarquico: Number(req.headers['x-test-level']) };
      return true;
    } }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  beforeEach(() => { jest.clearAllMocks(); ventas.actualizar.mockResolvedValue({ actualizados: 1 }); ventas.avance.mockResolvedValue({ empleados: [] }); });
  afterAll(async () => app.close());
  it('exige autenticacion', async () => { await request(app.getHttpServer()).post('/kpi/ventas/actualizar').send({fechaCorte:'2026-01-15'}).expect(401); });
  it.each([1,2])('nivel %s no actualiza todo Ventas', async nivel => {
    await request(app.getHttpServer()).post('/kpi/ventas/actualizar').set('x-test-level',String(nivel)).send({fechaCorte:'2026-01-15'}).expect(403);
    expect(ventas.actualizar).not.toHaveBeenCalled();
  });
  it.each([3,4])('nivel %s actualiza con actor autenticado', async nivel => {
    await request(app.getHttpServer()).post('/kpi/ventas/actualizar').set('x-test-level',String(nivel)).send({fechaCorte:'2026-01-15'}).expect(201);
    expect(ventas.actualizar).toHaveBeenCalledWith(7,'2026-01-15');
  });
  it('rechaza fecha mal formada e intento de indicar otro actor', async () => {
    await request(app.getHttpServer()).post('/kpi/ventas/actualizar').set('x-test-level','3').send({fechaCorte:'ayer',idUsuario:99}).expect(400);
    expect(ventas.actualizar).not.toHaveBeenCalled();
  });
  it('dashboard propio usa almacenamiento con actor autenticado', async () => {
    await request(app.getHttpServer()).get('/kpi/ventas/mi-dashboard?anio=2026&mes=1').set('x-test-level','1').expect(200);
    expect(ventas.avance).toHaveBeenCalledWith(7,2026,1);
  });
  it('empleado no consulta equipo', async () => {
    await request(app.getHttpServer()).get('/kpi/ventas/equipo?anio=2026&mes=1').set('x-test-level','1').expect(403);
  });
});
