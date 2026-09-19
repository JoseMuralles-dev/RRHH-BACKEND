/*
import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import { Repository } from 'typeorm';
import { KpiService } from '../../kpi/service/kpi.service';
import { KpiController } from '../kpi.controller';
import { ConsultarDashboardKpiDto } from '../dto/consultar-dashboard-kpi.dto';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { EvaluacionDesempeno } from '../../performance/entities/evaluacion-desempeno.entity';
import { MetricaKpiDiaria } from '../../performance/entities/metrica-kpi-diaria.entity';
import { ResultadoKpi } from '../../performance/entities/resultado-kpi.entity';
import { MetricaKpi } from '../../performance/entities/metrica-kpi.entity';
import { DetalleResultadoKpi } from '../../performance/entities/detalle-resultado-kpi.entity';

describe('Dashboard KPI personal', () => {
  const evaluaciones = { find: jest.fn() };
  const diarias = { find: jest.fn() };
  const resultados = { find: jest.fn() };
  const metricas = { find: jest.fn() };
  const detalles = { find: jest.fn() };
  const repositorios = new Map<unknown, { find: jest.Mock }>([
    [EvaluacionDesempeno, evaluaciones], [MetricaKpiDiaria, diarias],
    [ResultadoKpi, resultados], [MetricaKpi, metricas], [DetalleResultadoKpi, detalles],
  ]);
  const empleados = {
    findOne: jest.fn(),
    manager: { getRepository: jest.fn(entity => repositorios.get(entity)) },
  };
  let service: KpiService;
  beforeEach(() => {
    jest.clearAllMocks();
    empleados.findOne.mockResolvedValue({ idEmpleado: 22 });
    for (const repo of repositorios.values()) repo.find.mockResolvedValue([]);
    service = new KpiService(empleados as unknown as Repository<Empleado>);
  });

  it('rechaza una sesión sin empleado antes de consultar repositorios', async () => {
    await expect(service.obtenerDashboard(undefined, 2026, 8))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(empleados.findOne).not.toHaveBeenCalled();
    expect(empleados.manager.getRepository).not.toHaveBeenCalled();
  });

  it('filtra ambas fuentes por el empleado autenticado y devuelve un período vacío', async () => {
    const controller = new KpiController(service);
    const dashboard = await controller.obtenerMiDashboard(
      { user: { idEmpleado: 22 } }, { anio: 2024, mes: 2 },
    );
    expect(dashboard.tieneDatos).toBe(false);
    expect(dashboard.periodo.fechaFinal).toBe('2024-02-29');
    expect(evaluaciones.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { idEmpleado: 22, periodoAnio: 2024, periodoMes: 2, isActive: true },
    }));
    expect(diarias.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ idEmpleado: 22 }),
    }));
    expect(resultados.find).not.toHaveBeenCalled();
    expect(detalles.find).not.toHaveBeenCalled();
  });

  it('devuelve series diarias sin inventar una evaluación ni rellenar días faltantes con cero', async () => {
    diarias.find.mockResolvedValue([
      { idMetrica: 3, fecha: '2026-08-01', valor: '10.25', updatedAt: new Date('2026-08-02T00:00:00Z') },
    ]);
    metricas.find.mockResolvedValue([{ idMetrica: 3, codigokpi: 'BOD_ARTICULOS', nombre: 'Artículos' }]);
    const dashboard = await service.obtenerDashboard(22, 2026, 8);
    expect(dashboard.evaluaciones).toEqual([]);
    expect(dashboard.diasConDatos).toBe(1);
    expect(dashboard.seriesDiarias[0].puntos).toEqual([{ fecha: '2026-08-01', valor: 10.25 }]);
  });

  it('conserva el porcentaje del rango y los valores null de la evaluación guardada', async () => {
    evaluaciones.find.mockResolvedValue([{
      idEvaluacionDesempeno: 9, idDepartamento: 3, puntajeBase: '11.25',
      penalizacionTotal: '0', notaFinal: '11.25', metaGlobal: null,
    }]);
    resultados.find.mockResolvedValue([{
      idResultado: 8, idEvaluacionDesempeno: 9, idMetrica: 1,
      valorObtenido: '126', metaAplicada: '231', porcentajeCumplimiento: '75',
      puntosObtenidos: '11.25', observacion: null,
    }]);
    metricas.find.mockResolvedValue([{ idMetrica: 1, codigokpi: 'BOD_FACTURAS' }]);
    const dashboard = await service.obtenerDashboard(22, 2026, 8);
    expect(dashboard.evaluaciones[0].metaGlobal).toBeNull();
    expect(dashboard.evaluaciones[0].resultados[0]).toEqual(expect.objectContaining({
      porcentajeCumplimiento: 75, valorObtenido: 126, detalles: [],
    }));
  });

  it('valida el período y rechaza intentar elegir otro empleado en la query', async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
    const metadata = { type: 'query' as const, metatype: ConsultarDashboardKpiDto };
    await expect(pipe.transform({ anio: '2026', mes: '8' }, metadata))
      .resolves.toEqual({ anio: 2026, mes: 8 });
    await expect(pipe.transform({ anio: '2026', mes: '13' }, metadata)).rejects.toThrow();
    await expect(pipe.transform({ anio: '2026', mes: '8', idEmpleado: '99' }, metadata)).rejects.toThrow();
  });
});
*/