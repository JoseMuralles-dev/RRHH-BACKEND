import { NotFoundException, ValidationPipe } from '@nestjs/common';
import { Between, In, Repository } from 'typeorm';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { MetricaKpi } from '../../performance/entities/metrica-kpi.entity';
import { MetricaKpiDiaria } from '../../performance/entities/metrica-kpi-diaria.entity';
import { ConsultarMetricasEquipoDto } from '../dto/consultar-metricas-equipo.dto';
import { AiToolsService } from './ai-tools.service';
import { AiContextService } from './ai-context.service';

describe('AiToolsService', () => {
  const empleados = { findOne: jest.fn(), find: jest.fn() };
  const diarias = { find: jest.fn() };
  const metricas = { find: jest.fn() };
  const service = new AiToolsService(
    empleados as unknown as Repository<Empleado>,
    diarias as unknown as Repository<MetricaKpiDiaria>,
    metricas as unknown as Repository<MetricaKpi>,
    new AiContextService(
      empleados as unknown as Repository<Empleado>,
      metricas as unknown as Repository<MetricaKpi>,
    ),
  );

  beforeEach(() => jest.resetAllMocks());

  it('rechaza encargados inexistentes o inactivos', async () => {
    empleados.findOne.mockResolvedValue(null);
    await expect(service.obtenerMetricasEquipo(1, 2024, 2)).rejects.toThrow(
      NotFoundException,
    );
    expect(diarias.find).not.toHaveBeenCalled();
  });

  it('devuelve un periodo completo incluso sin subordinados', async () => {
    empleados.findOne.mockResolvedValue({ idEmpleado: 1 });
    empleados.find.mockResolvedValue([]);
    await expect(service.obtenerMetricasEquipo(1, 2024, 2)).resolves.toEqual({
      idEncargado: 1,
      periodo: {
        anio: 2024,
        mes: 2,
        fechaInicial: '2024-02-01',
        fechaFinal: '2024-02-29',
      },
      totalEmpleados: 0,
      empleados: [],
    });
    expect(diarias.find).not.toHaveBeenCalled();
  });

  it('consulta fechas SQL inclusivas y agrupa las series por empleado y metrica', async () => {
    empleados.findOne.mockResolvedValue({ idEmpleado: 1 });
    empleados.find.mockResolvedValue([
      { idEmpleado: 2, primerNombre: 'Ana', primerApellido: 'Perez' },
      { idEmpleado: 3, primerNombre: 'Luis' },
    ]);
    diarias.find.mockResolvedValue([
      { idEmpleado: 2, idMetrica: 4, fecha: '2024-02-01', valor: '12.50' },
      { idEmpleado: 2, idMetrica: 4, fecha: '2024-02-29', valor: '0.00' },
    ]);
    metricas.find.mockResolvedValue([
      {
        idMetrica: 4,
        codigoKpi: 'VENTAS',
        nombreKpi: 'Ventas',
        unidadMedida: 'Q',
        metaObjetivo: '0',
        pesoPorcentaje: '0',
      },
    ]);
    const result = await service.obtenerMetricasEquipo(1, 2024, 2);
    expect(diarias.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          idEmpleado: In([2, 3]),
          fecha: Between('2024-02-01', '2024-02-29'),
        },
      }),
    );
    expect(result.empleados[0].metricas[0]).toMatchObject({
      metaObjetivo: 0,
      pesoPorcentaje: 0,
      serieDiaria: [
        { fecha: '2024-02-01', valor: 12.5, desgloseOrigen: null },
        { fecha: '2024-02-29', valor: 0, desgloseOrigen: null },
      ],
    });
    expect(result.empleados[1].metricas).toEqual([]);
  });
});

describe('ConsultarMetricasEquipoDto', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const metadata = {
    type: 'query' as const,
    metatype: ConsultarMetricasEquipoDto,
  };

  it('convierte parametros de URL a numeros', async () => {
    await expect(
      pipe.transform({ idEncargado: '1', anio: '2026', mes: '9' }, metadata),
    ).resolves.toEqual({ idEncargado: 1, anio: 2026, mes: 9 });
  });

  it.each([
    { idEncargado: '0', anio: '2026', mes: '9' },
    { idEncargado: '1', anio: '2026', mes: '13' },
    { idEncargado: '1', anio: '10000', mes: '9' },
    { idEncargado: '1', anio: '2026' },
  ])('rechaza parametros invalidos: %j', async (query) => {
    await expect(pipe.transform(query, metadata)).rejects.toThrow();
  });
});
