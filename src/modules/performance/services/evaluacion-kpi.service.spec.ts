import { Logger, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EvaluacionKpiService } from './evaluacion-kpi.service';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { MetricaKpiDiaria } from '../entities/metrica-kpi-diaria.entity';
import { EvaluacionDesempeno } from '../entities/evaluacion-desempeno.entity';
import { ResultadoKpi } from '../entities/resultado-kpi.entity';
import { RangoKpi } from '../entities/rango-kpi.entity';
import { DetalleResultadoKpi } from '../entities/detalle-resultado-kpi.entity';

describe('Evaluación mensual por departamento', () => {
  const departamentos = { findOne: jest.fn() };
  const empleados = {
    find: jest.fn(),
    manager: { getRepository: jest.fn(() => departamentos) },
  };
  const diarias = { find: jest.fn() };
  const evaluaciones = {
    findOne: jest.fn(), create: jest.fn(), save: jest.fn(),
    manager: { transaction: jest.fn() },
  };
  const resultados = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const detalles = { delete: jest.fn(), create: jest.fn(), save: jest.fn() };
  const rangoQuery = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };
  const rangos = { createQueryBuilder: jest.fn(() => rangoQuery) };
  const manager = {
    getRepository: jest.fn(entity => {
      if (entity === MetricaKpiDiaria) return diarias;
      if (entity === EvaluacionDesempeno) return evaluaciones;
      if (entity === ResultadoKpi) return resultados;
      if (entity === RangoKpi) return rangos;
      if (entity === DetalleResultadoKpi) return detalles;
      throw new Error('Repositorio inesperado');
    }),
  };
  let service: EvaluacionKpiService;

  beforeEach(() => {
    jest.clearAllMocks();
    detalles.create.mockImplementation(value => value);
    resultados.save.mockImplementation(async value => value);
    departamentos.findOne.mockResolvedValue({ idDepartamento: 2 });
    evaluaciones.manager.transaction.mockImplementation(callback => callback(manager));
    service = new EvaluacionKpiService(
      diarias as unknown as Repository<MetricaKpiDiaria>,
      evaluaciones as unknown as Repository<EvaluacionDesempeno>,
      resultados as unknown as Repository<ResultadoKpi>,
      rangos as unknown as Repository<RangoKpi>,
      empleados as unknown as Repository<Empleado>,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('selecciona empleados activos del departamento y continúa tras omisiones y errores', async () => {
    empleados.find.mockResolvedValue([1, 2, 3, 4].map(idEmpleado => ({ idEmpleado })));
    const evaluar = jest.spyOn(service, 'procesarEvaluacionMensual');
    const respuesta = (idEmpleado: number) => ({
      idEvaluacion: idEmpleado, idEmpleado, periodo: { anio: 2026, mes: 9 },
      puntajeBase: 10, penalizacionTotal: 0, notaFinal: 10, resultados: [],
    });
    evaluar.mockResolvedValueOnce(respuesta(1))
      .mockRejectedValueOnce(new NotFoundException('Sin métricas'))
      .mockRejectedValueOnce(new Error('Fallo de escritura'))
      .mockResolvedValueOnce(respuesta(4));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const resumen = await service.procesarEvaluacionesDepartamento(2, 2026, 9);
    expect(empleados.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true, puesto: { idDepartamento: 2 } },
    }));
    expect(evaluar).toHaveBeenLastCalledWith(4, 2, 2026, 9);
    expect(resumen.empleadosEncontrados).toBe(4);
    expect(resumen.empleadosEvaluados).toBe(2);
    expect(resumen.empleadosSinDatos).toEqual([2]);
    expect(resumen.errores).toEqual([expect.objectContaining({ idEmpleado: 3 })]);
  });

  it('rechaza departamentos inexistentes o inactivos antes de procesar empleados', async () => {
    departamentos.findOne.mockResolvedValue(null);
    await expect(service.procesarEvaluacionesDepartamento(2, 2026, 9))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(empleados.find).not.toHaveBeenCalled();
  });

  it('reutiliza evaluación y resultado existentes con repositorios de la transacción', async () => {
    const metrica = { idMetrica: 5, codigoKpi: 'BOD_FACTURAS', metaObjetivo: '100' };
    diarias.find.mockResolvedValue([
      { idMetrica: 5, metrica, valor: '10' },
      { idMetrica: 5, metrica, valor: '20' },
    ]);
    evaluaciones.findOne.mockResolvedValue({ idEvaluacionDesempeno: 7 });
    resultados.findOne.mockResolvedValue({ idResultado: 8 });
    rangoQuery.getOne.mockResolvedValue({ porcentajeCumplimiento: '30', puntosOtorgados: '5' });
    const resumen = await service.procesarEvaluacionMensual(1, 2, 2026, 9);
    expect(evaluaciones.manager.transaction).toHaveBeenCalledTimes(1);
    expect(diarias.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ idEmpleado: 1, metrica: { idDepartamento: 2, isActive: true } }),
    }));
    expect(evaluaciones.create).not.toHaveBeenCalled();
    expect(resultados.create).not.toHaveBeenCalled();
    expect(resultados.save).toHaveBeenCalledWith(expect.objectContaining({
      idResultado: 8, valorObtenido: '30.00', puntosObtenidos: '5.00',
    }));
    expect(resumen.notaFinal).toBe(5);
  });

  it('no crea evaluaciones cuando no hay métricas en el período', async () => {
    diarias.find.mockResolvedValue([]);
    await expect(service.procesarEvaluacionMensual(1, 2, 2026, 9))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(evaluaciones.save).not.toHaveBeenCalled();
    expect(resultados.save).not.toHaveBeenCalled();
  });

  it('guarda dos componentes mensuales vinculados al resultado y los reemplaza al repetir', async () => {
    const metrica = { idMetrica: 5, codigoKpi: 'BOD_ARTICULOS', metaObjetivo: '150000' };
    diarias.find.mockResolvedValue([
      { idMetrica: 5, metrica, valor: '37788.25', desgloseOrigen: [
        { origen: 'FACTURAS', valor: '37788.25' }, { origen: 'TRASLADOS', valor: '0.00' },
      ] },
      { idMetrica: 5, metrica, valor: '84550.95', desgloseOrigen: [
        { origen: 'FACTURAS', valor: '0.00' }, { origen: 'TRASLADOS', valor: '84550.95' },
      ] },
    ]);
    evaluaciones.findOne.mockResolvedValue({ idEvaluacionDesempeno: 7 });
    resultados.findOne.mockResolvedValue({ idResultado: 8 });
    rangoQuery.getOne.mockResolvedValue(null);
    for (let intento = 0; intento < 2; intento++) {
      const respuesta = await service.procesarEvaluacionMensual(1, 2, 2026, 9);
      expect(respuesta.resultados[0]).toEqual(expect.objectContaining({
        valorMensual: 122339.2, detalleEstado: 'COMPLETO',
      }));
    }
    expect(detalles.delete).toHaveBeenCalledTimes(2);
    expect(detalles.delete).toHaveBeenCalledWith(expect.objectContaining({ idResultado: 8 }));
    expect(detalles.save).toHaveBeenLastCalledWith([
      expect.objectContaining({ idResultado: 8, origen: 'FACTURAS', valor: '37788.25' }),
      expect.objectContaining({ idResultado: 8, origen: 'TRASLADOS', valor: '84550.95' }),
    ]);
    expect(resultados.save).toHaveBeenCalledWith(expect.objectContaining({
      valorObtenido: '122339.20',
    }));
  });

  it('no inventa detalle para un mes con registros históricos sin desglose', async () => {
    const metrica = { idMetrica: 5, codigoKpi: 'BOD_ARTICULOS', metaObjetivo: '100' };
    diarias.find.mockResolvedValue([{ idMetrica: 5, metrica, valor: '30' }]);
    evaluaciones.findOne.mockResolvedValue({ idEvaluacionDesempeno: 7 });
    resultados.findOne.mockResolvedValue({ idResultado: 8 });
    rangoQuery.getOne.mockResolvedValue(null);
    const respuesta = await service.procesarEvaluacionMensual(1, 2, 2026, 9);
    expect(respuesta.resultados[0].detalleEstado).toBe('REQUIERE_REPROCESAR_ETL');
    expect(detalles.save).not.toHaveBeenCalled();
  });
});
