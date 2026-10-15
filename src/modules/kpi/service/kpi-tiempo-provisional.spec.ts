import { KpiService } from './kpi.service';
import { EvaluacionDesempeno } from '../../performance/entities/evaluacion-desempeno.entity';
import { ResultadoKpi } from '../../performance/entities/resultado-kpi.entity';
import { MetricaKpi } from '../../performance/entities/metrica-kpi.entity';

describe('Tiempo provisional en el dashboard', () => {
  async function consultar(mes = 10, conTiempo = false, bodega = true) {
    const resultados = [{ idResultado: 1, idMetrica: 1, idEvaluacionDesempeno: 9, valorObtenido: '75', metaAplicada: '100' },
      ...(conTiempo ? [{ idResultado: 2, idMetrica: 2, idEvaluacionDesempeno: 9, valorObtenido: '0', metaAplicada: null }] : [])];
    const manager = { getRepository: (entity: unknown) => ({ find: async () => {
      if (entity === EvaluacionDesempeno) return [{ idEvaluacionDesempeno: 9, idDepartamento: 3, penalizacionTotal: '0' }];
      if (entity === ResultadoKpi) return resultados;
      if (entity === MetricaKpi) return [{ idMetrica: 1, codigoKpi: bodega ? 'BOD_LINEAS' : 'VENTAS', pesoPorcentaje: '15' }, { idMetrica: 2, codigoKpi: 'BOD_TIEMPO_PREP' }];
      return [];
    } }) };
    const service = new KpiService({ findOne: async () => ({ idEmpleado: 1 }), manager } as any);
    return (await service.obtenerDashboard(1, 2026, mes)).evaluaciones[0];
  }
  it.each([false, true])('aporta 25 una sola vez con o sin registros de tiempo (%s)', async conTiempo => {
    const e = await consultar(8, conTiempo);
    expect(e.notaFinal).toBe(36.25);
    const tiempo = e.resultados.filter(r => r.codigo === 'BOD_TIEMPO_PREP');
    expect(tiempo).toHaveLength(1);
    expect(tiempo[0]).toMatchObject({ aportePorcentaje: 25, valorObtenido: null, metaAplicada: null, porcentajeCumplimiento: null, asignacionProvisional: true });
    expect(e.tiempoProvisional).toBe(true);
  });
  it.each([9, 10])('mantiene la asignacion en el mes %s', async mes => {
    expect((await consultar(mes)).notaFinal).toBe(36.25);
  });
  it('conserva los meses anteriores', async () => {
    const e = await consultar(7);
    expect(e.notaFinal).toBe(11.25);
    expect(e.tiempoProvisional).toBe(false);
  });
  it('no asigna el beneficio a otros departamentos', async () => {
    const e = await consultar(10, false, false);
    expect(e.notaFinal).toBe(11.25);
    expect(e.tiempoProvisional).toBe(false);
  });
});
