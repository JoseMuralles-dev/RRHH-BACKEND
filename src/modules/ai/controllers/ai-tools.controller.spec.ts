import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Server } from 'node:http';
import request from 'supertest';
import { JwtStrategy } from '../../auth/strategies/jwt.strategy';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { MetricaKpi } from '../../performance/entities/metrica-kpi.entity';
import { MetricaKpiDiaria } from '../../performance/entities/metrica-kpi-diaria.entity';
import { AiContextService } from '../services/ai-context.service';
import { AiToolsService } from '../services/ai-tools.service';
import { AiToolsController } from './ai-tools.controller';
import { AiToolsLegacyController } from './ai-tools-legacy.controller';

describe('HTTP tools con JWT y RBAC reales (repositorios simulados)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const empleados = { findOne: jest.fn(), find: jest.fn() };
  const metricas = { find: jest.fn(), findOne: jest.fn() };
  const qb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  const diarias = { find: jest.fn(), createQueryBuilder: jest.fn(() => qb) };
  const rutas = [
    ['resumen-equipo', { idEncargado: 10 }],
    ['metricas-empleado', { idEmpleado: 21 }],
    ['serie-metrica-empleado', { idEmpleado: 21, codigoKpi: 'BOD_FACTURAS' }],
    ['historico-equipo', { idEncargado: 10, cantidadMeses: 3 }],
    ['historico-empleado', { idEmpleado: 21, cantidadMeses: 3 }],
  ] as const;
  const token = (nivel = 3, idEmpleado: number | null = null) =>
    jwt.sign({ sub: 1, idEmpleado, nivelJerarquico: nivel });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({ secret: 'solo-pruebas-ia' }),
      ],
      controllers: [AiToolsController, AiToolsLegacyController],
      providers: [
        AiToolsService,
        AiContextService,
        JwtStrategy,
        { provide: ConfigService, useValue: { get: () => 'solo-pruebas-ia' } },
        { provide: getRepositoryToken(Empleado), useValue: empleados },
        { provide: getRepositoryToken(MetricaKpi), useValue: metricas },
        { provide: getRepositoryToken(MetricaKpiDiaria), useValue: diarias },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    jwt = module.get(JwtService);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    empleados.findOne.mockResolvedValue({
      idEmpleado: 21,
      puesto: { idDepartamento: 3 },
    });
    empleados.find.mockResolvedValue([
      { idEmpleado: 21, puesto: { idDepartamento: 3 } },
    ]);
    metricas.find.mockResolvedValue([
      {
        idMetrica: 4,
        idDepartamento: 3,
        codigoKpi: 'BOD_FACTURAS',
        nombreKpi: 'Facturas',
        unidadMedida: 'unidad',
        metaObjetivo: '200',
        tipoCalculo: 'SUMA',
        isActive: true,
      },
    ]);
    metricas.findOne.mockResolvedValue({ idMetrica: 4 });
    qb.getRawMany.mockResolvedValue([]);
    diarias.find.mockResolvedValue([]);
  });

  it.each(rutas)('POST %s responde 200 para RRHH', async (ruta, body) => {
    await request(app.getHttpServer() as Server)
      .post(`/ai-tools/${ruta}`)
      .auth(token(), { type: 'bearer' })
      .send({ ...body, anio: 2026, mes: 9 })
      .expect(200);
  });

  it.each(rutas)('POST %s requiere JWT', async (ruta, body) => {
    await request(app.getHttpServer() as Server)
      .post(`/ai-tools/${ruta}`)
      .send({ ...body, anio: 2026, mes: 9 })
      .expect(401);
    expect(diarias.find).not.toHaveBeenCalled();
    expect(qb.getRawMany).not.toHaveBeenCalled();
  });

  it('rechaza token vencido y firma invalida', async () => {
    for (const invalido of [
      jwt.sign({ sub: 1, nivelJerarquico: 3 }, { expiresIn: -1 }),
      jwt.sign({ sub: 1, nivelJerarquico: 3 }, { secret: 'otra-firma' }),
    ]) {
      await request(app.getHttpServer() as Server)
        .post('/ai-tools/resumen-equipo')
        .auth(invalido, { type: 'bearer' })
        .send({ idEncargado: 10, anio: 2026, mes: 9 })
        .expect(401);
    }
  });

  it.each(['resumen-equipo', 'historico-equipo'])(
    'empleado no puede invocar %s',
    async (ruta) => {
      await request(app.getHttpServer() as Server)
        .post(`/ai-tools/${ruta}`)
        .auth(token(1, 21), { type: 'bearer' })
        .send({ idEncargado: 21, anio: 2026, mes: 9 })
        .expect(403);
      expect(empleados.find).not.toHaveBeenCalled();
    },
  );

  it.each([
    'metricas-empleado',
    'serie-metrica-empleado',
    'historico-empleado',
  ])('empleado solo consulta su ID en %s', async (ruta) => {
    const body = {
      anio: 2026,
      mes: 9,
      ...(ruta === 'serie-metrica-empleado'
        ? { codigoKpi: 'BOD_FACTURAS' }
        : {}),
    };
    await request(app.getHttpServer() as Server)
      .post(`/ai-tools/${ruta}`)
      .auth(token(1, 21), { type: 'bearer' })
      .send({ ...body, idEmpleado: 21 })
      .expect(200);
    jest.clearAllMocks();
    await request(app.getHttpServer() as Server)
      .post(`/ai-tools/${ruta}`)
      .auth(token(1, 21), { type: 'bearer' })
      .send({ ...body, idEmpleado: 99 })
      .expect(403);
    expect(diarias.find).not.toHaveBeenCalled();
    expect(qb.getRawMany).not.toHaveBeenCalled();
  });

  it('encargado consulta equipo propio y no el de otro encargado', async () => {
    await request(app.getHttpServer() as Server)
      .post('/ai-tools/resumen-equipo')
      .auth(token(2, 10), { type: 'bearer' })
      .send({ idEncargado: 10, anio: 2026, mes: 9 })
      .expect(200);
    jest.clearAllMocks();
    await request(app.getHttpServer() as Server)
      .post('/ai-tools/resumen-equipo')
      .auth(token(2, 10), { type: 'bearer' })
      .send({ idEncargado: 11, anio: 2026, mes: 9 })
      .expect(403);
    expect(qb.getRawMany).not.toHaveBeenCalled();
  });

  it('encargado no consulta un empleado ajeno', async () => {
    empleados.findOne
      .mockResolvedValueOnce({ idEmpleado: 10 })
      .mockResolvedValueOnce(null);
    await request(app.getHttpServer() as Server)
      .post('/ai-tools/metricas-empleado')
      .auth(token(2, 10), { type: 'bearer' })
      .send({ idEmpleado: 99, anio: 2026, mes: 9 })
      .expect(403);
    expect(diarias.find).not.toHaveBeenCalled();
  });

  it.each([
    { mes: 13 },
    { anio: 1999 },
    { idEmpleado: -1 },
    { cantidadMeses: 13 },
    { cantidadMeses: 0 },
    { cantidadMeses: null },
    { cantidadMeses: 2.5 },
    { nivelJerarquico: 4 },
    { user: { idUsuario: 1, nivelJerarquico: 4 } },
  ])(
    'rechaza parametros invalidos o contexto falsificado %j',
    async (cambio) => {
      await request(app.getHttpServer() as Server)
        .post('/ai-tools/historico-empleado')
        .auth(token(1, 21), { type: 'bearer' })
        .send({ idEmpleado: 21, anio: 2026, mes: 9, ...cambio })
        .expect(400);
      expect(qb.getRawMany).not.toHaveBeenCalled();
    },
  );

  it('cantidadMeses por defecto es 3 y el limite superior es 12', async () => {
    await request(app.getHttpServer() as Server)
      .post('/ai-tools/historico-empleado')
      .auth(token(), { type: 'bearer' })
      .send({ idEmpleado: 21, anio: 2026, mes: 9 })
      .expect(200)
      .expect((res) => {
        expect((res.body as { cantidadMeses: number }).cantidadMeses).toBe(3);
      });
    await request(app.getHttpServer() as Server)
      .post('/ai-tools/historico-empleado')
      .auth(token(), { type: 'bearer' })
      .send({ idEmpleado: 21, anio: 2026, mes: 9, cantidadMeses: 12 })
      .expect(200);
  });

  it('conserva GET legado y su restriccion de nivel 3', async () => {
    empleados.find.mockResolvedValue([]);
    await request(app.getHttpServer() as Server)
      .get('/ia/tools/metricas-equipo?idEncargado=10&anio=2026&mes=9')
      .auth(token(), { type: 'bearer' })
      .expect(200)
      .expect({
        idEncargado: 10,
        periodo: {
          anio: 2026,
          mes: 9,
          fechaInicial: '2026-09-01',
          fechaFinal: '2026-09-30',
        },
        totalEmpleados: 0,
        empleados: [],
      });
    await request(app.getHttpServer() as Server)
      .get('/ia/tools/metricas-equipo?idEncargado=10&anio=2026&mes=9')
      .auth(token(2, 10), { type: 'bearer' })
      .expect(403);
  });
});
