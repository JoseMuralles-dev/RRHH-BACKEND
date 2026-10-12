import { KpiService } from './kpi.service';
import { Repository } from 'typeorm';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { EvaluacionDesempeno } from '../../performance/entities/evaluacion-desempeno.entity';
import { ResultadoKpi } from '../../performance/entities/resultado-kpi.entity';
import { MetricaKpi } from '../../performance/entities/metrica-kpi.entity';
it('calcula el porcentaje histórico con la meta aplicada, conservando la nota sin escribir', async () => {
  const save = jest.fn();
  const getRepository = jest.fn(entity => ({ save, find: async () => {
    if (entity === EvaluacionDesempeno) return [{ idEvaluacionDesempeno: 9, idDepartamento: 1, puntajeBase: '11.25', penalizacionTotal: '0', notaFinal: '11.25', metaGlobal: '100' }];
    if (entity === ResultadoKpi) return [{ idResultado: 8, idEvaluacionDesempeno: 9, idMetrica: 1, valorObtenido: '126', metaAplicada: '231', porcentajeCumplimiento: '75', puntosObtenidos: '11.25' }];
    if (entity === MetricaKpi) return [{ idMetrica: 1, codigoKpi: 'BOD_FACTURAS', metaObjetivo: '999' }];
    return [];
  }}));
  const service = new KpiService({ findOne: async () => ({ idEmpleado: 10 }), manager: { getRepository } } as unknown as Repository<Empleado>);
  const result = await service.obtenerDashboard(10, 2026, 9);
  expect(result.evaluaciones[0].resultados[0].porcentajeCumplimiento).toBe(54.55);
  expect(result.evaluaciones[0].notaFinal).toBe(11.25);
  expect(save).not.toHaveBeenCalled();
});
