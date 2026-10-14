import { cumplimientoReal } from './cumplimiento-kpi';
import { EvaluacionKpiService } from './evaluacion-kpi.service';
import { EntityManager, Repository } from 'typeorm';
import { Departamento } from '../../organization/departamentos/entities/departamento.entity';
import { MetricaKpi } from '../entities/metrica-kpi.entity';
import { InspeccionCincoS } from '../../kpi/cinco-s/inspeccion-cinco-s.entity';
import { MetricaKpiDiaria } from '../entities/metrica-kpi-diaria.entity';
import { EvaluacionDesempeno } from '../entities/evaluacion-desempeno.entity';
import { ResultadoKpi } from '../entities/resultado-kpi.entity';
import { RangoKpi } from '../entities/rango-kpi.entity';

describe('Porcentaje real y nota independiente', () => {
  it.each([
    [126, 231, 'BOD_FACTURAS', 126 / 231 * 100], [0, 100, 'BOD_LINEAS', 0],
    [120, 100, 'BOD_ARTICULOS', 120], [null, 100, 'BOD_FACTURAS', null],
    [100, null, 'BOD_FACTURAS', null], [100, 0, 'BOD_FACTURAS', null],
    [10, 20, 'BOD_TIEMPO_PREP', 200], [40, 20, 'BOD_TIEMPO_PREP', 50],
    [0, 20, 'BOD_TIEMPO_PREP', null],
  ])('%s frente a %s para %s = %s', (valor, meta, codigo, esperado) => {
    expect(cumplimientoReal(valor, meta, codigo as string)).toBe(esperado);
  });
  it.each([true, false])('no depende del porcentaje del rango, incluso sin rango (%s)', async conRango => {
    const diarias = { find: jest.fn().mockResolvedValue([60, 66].map(valor => ({ valor: String(valor), idMetrica: 1, metrica: { idMetrica: 1, codigoKpi: 'BOD_FACTURAS', metaObjetivo: '231' } }))) };
    const evaluaciones = { manager: {} as EntityManager, findOne: jest.fn().mockResolvedValue({ idEvaluacionDesempeno: 7 }), save: jest.fn(async v => v) };
    const resultados = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn(v => v), save: jest.fn(async v => v) };
    const query = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(conRango ? { porcentajeCumplimiento: '75', puntosOtorgados: '11.25' } : null) };
    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === Departamento) return { findOne: async () => ({ idDepartamento: 1 }) };
        if (entity === MetricaKpiDiaria) return diarias;
        if (entity === EvaluacionDesempeno) return evaluaciones;
        if (entity === ResultadoKpi) return resultados;
        if (entity === RangoKpi) return { createQueryBuilder: () => query };
        if (entity === MetricaKpi) return { findOne: async () => ({ idMetrica: 50 }) };
        if (entity === InspeccionCincoS) return { find: async () => [] };
        throw new Error('Repositorio inesperado');
      },
      transaction: async (fn: (m: EntityManager) => unknown) => fn(manager as unknown as EntityManager),
    };
    evaluaciones.manager = manager as unknown as EntityManager;
    const service = new EvaluacionKpiService(diarias as unknown as Repository<MetricaKpiDiaria>, evaluaciones as unknown as Repository<EvaluacionDesempeno>, resultados as unknown as Repository<ResultadoKpi>, { createQueryBuilder: () => query } as unknown as Repository<RangoKpi>);
    const respuesta = await service.procesarEvaluacionMensual(10, 1, 2026, 9);
    expect(resultados.save).toHaveBeenCalledWith(expect.objectContaining({ valorObtenido: '126.00', porcentajeCumplimiento: '54.55', puntosObtenidos: '8.18' }));
    expect(Number(respuesta.notaFinal)).toBe(8.18);
  });
});
