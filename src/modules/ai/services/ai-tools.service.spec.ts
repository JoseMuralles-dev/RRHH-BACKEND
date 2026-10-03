import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Between, Repository } from 'typeorm';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { MetricaKpi } from '../../performance/entities/metrica-kpi.entity';
import { MetricaKpiDiaria } from '../../performance/entities/metrica-kpi-diaria.entity';
import { AiContextService } from './ai-context.service';
import { AiToolsService } from './ai-tools.service';
import { numeroAnalitico } from '../utils/numero-analitico';

describe('Tools analiticas', () => {
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
  const context = new AiContextService(
    empleados as unknown as Repository<Empleado>,
    metricas as unknown as Repository<MetricaKpi>,
  );
  const service = new AiToolsService(
    empleados as unknown as Repository<Empleado>,
    diarias as unknown as Repository<MetricaKpiDiaria>,
    metricas as unknown as Repository<MetricaKpi>,
    context,
  );
  const rrhh = { idUsuario: 1, idEmpleado: null, nivelJerarquico: 3 };
  const catalogo = [
    {
      idMetrica: 4,
      idDepartamento: 3,
      codigoKpi: 'BOD_FACTURAS',
      nombreKpi: 'Facturas',
      unidadMedida: 'unidad',
      metaObjetivo: '0',
      tipoCalculo: 'SUMA',
      isActive: true,
    },
    {
      idMetrica: 5,
      idDepartamento: 3,
      codigoKpi: 'BOD_LINEAS',
      nombreKpi: 'Lineas',
      unidadMedida: 'unidad',
      metaObjetivo: '100.00',
      tipoCalculo: 'SUMA',
      isActive: true,
    },
  ];
  beforeEach(() => {
    jest.clearAllMocks();
    empleados.findOne.mockResolvedValue({
      idEmpleado: 21,
      puesto: { idDepartamento: 3 },
    });
    empleados.find.mockResolvedValue([
      { idEmpleado: 21, puesto: { idDepartamento: 3 } },
      { idEmpleado: 22, puesto: { idDepartamento: 3 } },
    ]);
    metricas.find.mockResolvedValue(catalogo);
    metricas.findOne.mockResolvedValue({ idMetrica: 4 });
    diarias.find.mockResolvedValue([]);
    qb.getRawMany.mockResolvedValue([]);
  });

  it('resume todos los empleados en una consulta agregada sin series ni datos personales', async () => {
    qb.getRawMany.mockResolvedValue([
      {
        idEmpleado: '21',
        idMetrica: '4',
        periodo: '2026-09',
        total: '20.50',
        promedioDiario: '10.250000',
        minimo: '8',
        maximo: '12.50',
        diasConDatos: '2',
      },
      {
        idEmpleado: '22',
        idMetrica: '4',
        periodo: '2026-09',
        total: '0',
        promedioDiario: '0',
        minimo: '0',
        maximo: '0',
        diasConDatos: '1',
      },
    ]);
    const resultado = await service.obtenerResumenEquipo(
      { idEncargado: 10, anio: 2026, mes: 9 },
      rrhh,
    );
    expect(resultado.empleados[0].metricas[0]).toMatchObject({
      total: 20.5,
      promedioDiario: 10.25,
      minimo: 8,
      maximo: 12.5,
      diasConDatos: 2,
      metaObjetivo: 0,
      tieneDatos: true,
    });
    expect(resultado.empleados[0].metricas[1]).toMatchObject({
      total: null,
      promedioDiario: null,
      minimo: null,
      maximo: null,
      diasConDatos: 0,
      tieneDatos: false,
    });
    expect(resultado.empleados[1].metricas[0]).toMatchObject({
      total: 0,
      tieneDatos: true,
    });
    expect(qb.where).toHaveBeenCalledWith('diaria.idEmpleado IN (:...ids)', {
      ids: [21, 22],
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'diaria.fecha BETWEEN :inicio AND :fin',
      { inicio: '2026-09-01', fin: '2026-09-30' },
    );
    for (const [sql, alias] of [
      ['SUM(diaria.valor)', 'total'],
      ['AVG(diaria.valor)', 'promedioDiario'],
      ['MIN(diaria.valor)', 'minimo'],
      ['MAX(diaria.valor)', 'maximo'],
      ['COUNT(DISTINCT diaria.fecha)', 'diasConDatos'],
    ]) {
      expect(qb.addSelect).toHaveBeenCalledWith(sql, alias);
    }
    expect(diarias.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(diarias.find).not.toHaveBeenCalled();
    expect(metricas.find).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(resultado)).not.toMatch(
      /serieDiaria|dpi|primerNombre|notaFinal/,
    );
  });

  it('equipo vacio no dispara consultas de metricas', async () => {
    empleados.find.mockResolvedValue([]);
    const resultado = await service.obtenerResumenEquipo(
      { idEncargado: 10, anio: 2026, mes: 9 },
      rrhh,
    );
    expect(resultado.empleados).toEqual([]);
    expect(diarias.createQueryBuilder).not.toHaveBeenCalled();
    expect(metricas.find).not.toHaveBeenCalled();
  });

  it('historico de 3 meses incluye huecos y cruza año con una consulta', async () => {
    qb.getRawMany.mockResolvedValue([
      {
        idEmpleado: 21,
        idMetrica: 4,
        periodo: '2025-12',
        total: '2',
        promedioDiario: '2',
        minimo: '2',
        maximo: '2',
        diasConDatos: '1',
      },
    ]);
    const resultado = await service.obtenerHistoricoEmpleado(
      { idEmpleado: 21, anio: 2026, mes: 1, cantidadMeses: 3 },
      rrhh,
    );
    expect(resultado.periodos.map((p) => p.periodo.fechaInicial)).toEqual([
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
    ]);
    expect(resultado.periodos.map((p) => p.tieneDatos)).toEqual([
      false,
      true,
      false,
    ]);
    expect(qb.andWhere).toHaveBeenCalledWith(expect.any(String), {
      inicio: '2025-11-01',
      fin: '2026-01-31',
    });
    expect(qb.getRawMany).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(resultado)).not.toContain('serieDiaria');
  });

  it('historico de equipo no hace una consulta por empleado ni por mes', async () => {
    const resultado = await service.obtenerHistoricoEquipo(
      { idEncargado: 10, anio: 2026, mes: 9, cantidadMeses: 12 },
      rrhh,
    );
    expect(resultado.empleados).toHaveLength(2);
    expect(resultado.empleados[0].periodos).toHaveLength(12);
    expect(qb.getRawMany).toHaveBeenCalledTimes(1);
    expect(metricas.find).toHaveBeenCalledTimes(1);
  });

  it('detalle conserva fuentes y convierte valores de desglose sin campos extra', async () => {
    diarias.find.mockResolvedValue([
      {
        idMetrica: 4,
        fecha: '2024-02-29',
        valor: '12.50',
        fuente: 'SAP',
        desgloseOrigen: [
          { origen: 'FACTURAS', valor: '12.50', comentario: 'NO_EXPONER' },
        ],
      },
    ]);
    const resultado = await service.obtenerMetricasEmpleado(
      { idEmpleado: 21, anio: 2024, mes: 2 },
      rrhh,
    );
    expect(resultado.metricas[0].serieDiaria).toEqual([
      {
        fecha: '2024-02-29',
        valor: 12.5,
        fuente: 'SAP',
        desgloseOrigen: [{ origen: 'FACTURAS', valor: 12.5 }],
      },
    ]);
    expect(resultado.metricas[1]).toMatchObject({
      tieneDatos: false,
      serieDiaria: [],
    });
    expect(diarias.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          idEmpleado: 21,
          fecha: Between('2024-02-01', '2024-02-29'),
        },
      }),
    );
  });

  it('serie filtra la metrica en la base de datos y devuelve solo esa configuracion', async () => {
    const resultado = await service.obtenerSerieMetricaEmpleado(
      { idEmpleado: 21, anio: 2026, mes: 9, codigoKpi: 'BOD_FACTURAS' },
      rrhh,
    );
    expect(resultado.metricas).toHaveLength(1);
    expect(resultado.metricas[0].codigoKpi).toBe('BOD_FACTURAS');
    expect(diarias.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          idEmpleado: 21,
          idMetrica: 4,
          fecha: Between('2026-09-01', '2026-09-30'),
        },
      }),
    );
  });

  it('KPI inexistente devuelve 404 sin consulta diaria', async () => {
    metricas.findOne.mockResolvedValue(null);
    await expect(
      service.obtenerSerieMetricaEmpleado(
        { idEmpleado: 21, anio: 2026, mes: 9, codigoKpi: 'NO_EXISTE' },
        rrhh,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(diarias.find).not.toHaveBeenCalled();
  });

  it('no expone un KPI de otro departamento sin registros del empleado', async () => {
    metricas.findOne.mockResolvedValue({ idMetrica: 99 });
    await expect(
      service.obtenerSerieMetricaEmpleado(
        { idEmpleado: 21, anio: 2026, mes: 9, codigoKpi: 'OTRO' },
        rrhh,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('mantiene KPI inactivos registrados sin atribuirlos a otros empleados', async () => {
    metricas.find.mockResolvedValue([
      ...catalogo,
      { ...catalogo[0], idMetrica: 8, codigoKpi: 'ANTIGUO', isActive: false },
    ]);
    qb.getRawMany.mockResolvedValue([
      {
        idEmpleado: 21,
        idMetrica: 8,
        periodo: '2026-09',
        total: '2',
        promedioDiario: '2',
        minimo: '2',
        maximo: '2',
        diasConDatos: '1',
      },
    ]);
    const resultado = await service.obtenerResumenEquipo(
      { idEncargado: 10, anio: 2026, mes: 9 },
      rrhh,
    );
    expect(resultado.empleados[0].metricas.map((m) => m.codigoKpi)).toContain(
      'ANTIGUO',
    );
    expect(
      resultado.empleados[1].metricas.map((m) => m.codigoKpi),
    ).not.toContain('ANTIGUO');
  });

  it('autoriza antes de buscar el codigo KPI o consultar datos', async () => {
    const empleado = { idUsuario: 1, idEmpleado: 10, nivelJerarquico: 1 };
    await expect(
      service.obtenerSerieMetricaEmpleado(
        { idEmpleado: 99, anio: 2026, mes: 9, codigoKpi: 'BOD_FACTURAS' },
        empleado,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(diarias.find).not.toHaveBeenCalled();
    expect(metricas.findOne).not.toHaveBeenCalled();
  });

  it.each(['NaN', 'Infinity', '', '999999999999999999'])(
    'no convierte silenciosamente un decimal inseguro %s',
    (valor) => {
      expect(() => numeroAnalitico(valor)).toThrow();
    },
  );
});
