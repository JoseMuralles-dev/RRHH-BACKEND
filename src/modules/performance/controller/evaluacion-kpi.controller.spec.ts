import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../../auth/strategies/jwt.strategy';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { EvaluacionKpiController } from './evaluacion-kpi.controller';
import { EvaluacionKpiService } from '../services/evaluacion-kpi.service';

describe('Rutas de evaluación KPI', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const servicio = {
    procesarEvaluacionesDepartamento: jest.fn().mockResolvedValue({ empleadosEvaluados: 12 }),
    procesarEvaluacionMensual: jest.fn().mockResolvedValue({ idEvaluacion: 1 }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: 'evaluaciones-test-only' })],
      controllers: [EvaluacionKpiController],
      providers: [JwtStrategy, { provide: ConfigService, useValue: { get: () => 'evaluaciones-test-only' } }, { provide: EvaluacionKpiService, useValue: servicio }],
    }).compile();
    jwt = module.get(JwtService);
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('acepta POST mensual sin idEmpleado y delega al departamento', async () => {
    await request(app.getHttpServer()).post('/performance/evaluaciones/mensual')
      .set('Authorization', `Bearer ${jwt.sign({ sub: 1, nivelJerarquico: 3 })}`)
      .send({ idDepartamento: 3, anio: 2026, mes: 8 })
      .expect(201).expect({ empleadosEvaluados: 12 });
    expect(servicio.procesarEvaluacionesDepartamento).toHaveBeenCalledWith(3, 2026, 8);
  });

  it('rechaza un período inválido', async () => {
    await request(app.getHttpServer()).post('/performance/evaluaciones/mensual')
      .set('Authorization', `Bearer ${jwt.sign({ sub: 1, nivelJerarquico: 3 })}`)
      .send({ idDepartamento: 3, anio: 2026, mes: 13 }).expect(400);
  });

  it('conserva la ruta individual procesar', async () => {
    await request(app.getHttpServer()).post('/performance/evaluaciones/procesar')
      .set('Authorization', `Bearer ${jwt.sign({ sub: 1, nivelJerarquico: 3 })}`)
      .send({ idEmpleado: 22, idDepartamento: 3, anio: 2026, mes: 8 }).expect(201);
    expect(servicio.procesarEvaluacionMensual).toHaveBeenCalledWith(22, 3, 2026, 8);
  });
  it.each(['mensual', 'procesar'])('protege %s sin token y contra usuarios sin nivel', async ruta => {
    await request(app.getHttpServer()).post('/performance/evaluaciones/' + ruta).send({}).expect(401);
    await request(app.getHttpServer()).post('/performance/evaluaciones/' + ruta)
      .set('Authorization', `Bearer ${jwt.sign({ sub: 1, nivelJerarquico: 1 })}`).send({}).expect(403);
  });
});
