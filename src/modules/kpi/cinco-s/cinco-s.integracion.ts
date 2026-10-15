import { CODIGO_TIEMPO, tiempoProvisionalVigente } from '../../performance/services/tiempo-provisional';
import { aporteKpi } from '../../performance/services/ponderacion-kpi';
import { EntityManager } from 'typeorm';
import { MetricaKpi } from '../../performance/entities/metrica-kpi.entity';
import { EvaluacionDesempeno } from '../../performance/entities/evaluacion-desempeno.entity';
import { ResultadoKpi } from '../../performance/entities/resultado-kpi.entity';
import { InspeccionCincoS } from './inspeccion-cinco-s.entity';
import { resumenCincoS } from './cinco-s.reglas';

export const codigoCincoS = (idDepartamento: number) => `DEP_5S_${idDepartamento}`;

/** Invocar dentro de una transacción que tenga bloqueado el departamento. */
export async function asegurarMetricaCincoS(manager: EntityManager, idDepartamento: number) {
  const repo = manager.getRepository(MetricaKpi);
  let metrica = await repo.findOne({ where: { codigoKpi: codigoCincoS(idDepartamento) } });
  if (!metrica) {
    metrica = await repo.save(repo.create({
      idDepartamento, codigoKpi: codigoCincoS(idDepartamento),
      nombreKpi: '5S · Orden y limpieza', descripcion: 'Promedio de cuatro inspecciones del departamento. Sin cuadre de inventarios.',
      unidadMedida: '%', pesoPorcentaje: '20', metaObjetivo: '100',
      tipoCalculo: 'DIRECTO', fuenteDatos: 'MANUAL', origenDatos: 'INSPECCION_5S',
      penalizacionPorEvento: '0', isActive: true,
    }));
  }
  return metrica;
}

/** Sustituye solamente el aporte 5S; nunca lo acumula dos veces. */
export async function aplicarCincoS(
  manager: EntityManager, evaluacion: EvaluacionDesempeno,
  metrica: MetricaKpi, baseIncluyeCincoS = true,
) {
  const inspecciones = await manager.getRepository(InspeccionCincoS).find({ where: {
    idDepartamento: evaluacion.idDepartamento, anio: evaluacion.periodoAnio, mes: evaluacion.periodoMes,
  }, order: { numero: 'ASC' } });
  const resumen = resumenCincoS(inspecciones);
  const repo = manager.getRepository(ResultadoKpi);
  let resultado = await repo.findOne({ where: {
    idEvaluacionDesempeno: evaluacion.idEvaluacionDesempeno, idMetrica: metrica.idMetrica, isActive: true,
  } });
  const anterior = baseIncluyeCincoS ? Number(resultado?.puntosObtenidos ?? 0) : 0;
  if (resumen.completo) {
    resultado = repo.create({
      ...resultado,
      idEvaluacionDesempeno: evaluacion.idEvaluacionDesempeno,
      idMetrica: metrica.idMetrica, 
      valorObtenido: String(resumen.promedio),
      metaAplicada: '100', 
      porcentajeCumplimiento: String(resumen.promedio),
      puntosObtenidos: String(resumen.puntosKpi), 
      cantidadEventos: 0,
      penalizacionGenerada: '0', isActive: true,
      observacion: `Promedio de inspecciones ${inspecciones.map(i => '#' + i.idInspeccion).join(', ')}. Peso 20%. Sin inventarios.`,
    });
    await repo.save(resultado);
  } else if (resultado) {
    resultado.isActive = false;
    await repo.save(resultado);
  }
  // Los puntos 5S son décimas exactas. La nota existente se almacena en centésimas.
  let baseOperativa: number | null = null;
  if (baseIncluyeCincoS && tiempoProvisionalVigente(evaluacion.periodoAnio, evaluacion.periodoMes)) {
    const existentes = await repo.find({ where: { idEvaluacionDesempeno: evaluacion.idEvaluacionDesempeno, isActive: true }, relations: { metrica: true } });
    if (existentes.some(r => r.metrica?.codigoKpi.startsWith('BOD_'))) {
      baseOperativa = existentes.filter(r => r.idMetrica !== metrica.idMetrica && r.metrica?.codigoKpi !== CODIGO_TIEMPO)
        .reduce((total, r) => total + aporteKpi(r.valorObtenido, r.metaAplicada, r.metrica?.codigoKpi, r.metrica?.pesoPorcentaje), 25);
    }
  }
  const baseCentavos = baseOperativa !== null
    ? Math.round((baseOperativa + (resumen.puntosKpi ?? 0)) * 100)
    : Math.round(Number(evaluacion.puntajeBase) * 100) - Math.round(anterior * 100)
    + Math.round((resumen.puntosKpi ?? 0) * 100);
  evaluacion.puntajeBase = Math.min(100, baseCentavos / 100).toFixed(2);
  evaluacion.notaFinal = Math.max(0, Math.min(100, baseCentavos / 100) - Number(evaluacion.penalizacionTotal)).toFixed(2);
  evaluacion.estado = resumen.completo ? 'CALCULADA' : 'PENDIENTE_5S';
  await manager.getRepository(EvaluacionDesempeno).save(evaluacion);
  return resumen;
}
