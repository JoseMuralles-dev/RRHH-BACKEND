import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { EvaluacionKpiController } from './evaluacion-kpi.controller';
import { EvaluacionKpiService } from '../services/evaluacion-kpi.service';

describe('Rutas de evaluación KPI', () => {
  let app: INestApplication;
  const servicio = {
    procesarEvaluacionesDepartamento: jest.fn().mockResolvedValue({ empleadosEvaluados: 12 }),
    procesarEvaluacionMensual: jest.fn().mockResolvedValue({ idEvaluacion: 1 }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [EvaluacionKpiController],
      providers: [{ provide: EvaluacionKpiService, useValue: servicio }],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('acepta POST mensual sin idEmpleado y delega al departamento', async () => {
    await request(app.getHttpServer()).post('/performance/evaluaciones/mensual')
      .send({ idDepartamento: 3, anio: 2026, mes: 8 })
      .expect(201).expect({ empleadosEvaluados: 12 });
    expect(servicio.procesarEvaluacionesDepartamento).toHaveBeenCalledWith(3, 2026, 8);
  });

  it('rechaza un período inválido', async () => {
    await request(app.getHttpServer()).post('/performance/evaluaciones/mensual')
      .send({ idDepartamento: 3, anio: 2026, mes: 13 }).expect(400);
  });

  it('conserva la ruta individual procesar', async () => {
    await request(app.getHttpServer()).post('/performance/evaluaciones/procesar')
      .send({ idEmpleado: 22, idDepartamento: 3, anio: 2026, mes: 8 }).expect(201);
    expect(servicio.procesarEvaluacionMensual).toHaveBeenCalledWith(22, 3, 2026, 8);
  });
});
