import { DataSource, In } from 'typeorm';
import { MetricaKpi } from '../entities/metrica-kpi.entity';
import { PerformanceService } from './performance.service';
import { EvaluacionKpiService } from './evaluacion-kpi.service';

export function fechasActualizacion(args: string[], ahora = new Date()): string[] {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
  const ayer = new Date(Date.parse(hoy + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
  if (args.length > 2) throw new Error('Uso: actualizar-kpi [YYYY-MM-DD] [YYYY-MM-DD final]');
  const inicio = args[0] ?? ayer, fin = args[1] ?? inicio;
  const valida = (fecha: string) => /^\d{4}-\d{2}-\d{2}$/.test(fecha) && Number.isFinite(Date.parse(fecha)) && new Date(fecha).toISOString().slice(0, 10) === fecha;
  if (!valida(inicio) || !valida(fin) || inicio > fin || fin >= hoy) throw new Error('Indica fechas validas de dias terminados, en orden.');
  const dias = (Date.parse(fin) - Date.parse(inicio)) / 86400000 + 1;
  if (dias > 366) throw new Error('Procesa como maximo 366 dias por ejecucion.');
  return Array.from({ length: dias }, (_, i) => new Date(Date.parse(inicio) + i * 86400000).toISOString().slice(0, 10));
}

export async function actualizarKpiProgramado(
  data: DataSource, etl: PerformanceService, calculador: EvaluacionKpiService,
  fechas: string[], registrar: (mensaje: string) => void,
) {
  // El bloqueo pertenece a esta conexion: evita ejecuciones simultaneas del job, incluso en varios servidores.
  const conexion = data.createQueryRunner();
  await conexion.connect();
  let bloqueado = false;
  try {
    const filas = await conexion.query("SELECT GET_LOCK('rrhh_kpi_bodega_diario', 0) AS adquirido");
    bloqueado = Number(filas[0]?.adquirido) === 1;
    if (!bloqueado) throw new Error('Ya hay otra actualizacion programada de KPI ejecutandose.');
    const metricas = await data.getRepository(MetricaKpi).find({ where: {
      codigoKpi: In(['BOD_FACTURAS', 'BOD_LINEAS', 'BOD_ARTICULOS', 'BOD_TIEMPO_PREP']), isActive: true,
    } });
    if (metricas.length !== 4) throw new Error('Deben estar configuradas las cuatro metricas operativas de Bodega.');
    const departamentos = [...new Set(metricas.map(m => m.idDepartamento))];
    if (departamentos.length !== 1) throw new Error('Las metricas de Bodega deben pertenecer al mismo departamento.');
    for (const fecha of fechas) {
      const carga = await etl.procesarMetricasBodega(fecha);
      registrar(JSON.stringify({ etapa: 'ETL', fecha, filasSap: carga.filasSap, registrosProcesados: carga.registrosProcesados, sinRelacion: carga.empleadosSinRelacion.length }));
      if (carga.empleadosSinRelacion.length) throw new Error(`ETL ${fecha}: hay empleados SAP sin relacion con RRHH. Revisa sus codigos y repite el proceso.`);
    }
    for (const periodo of new Set(fechas.map(f => f.slice(0, 7)))) {
      const [anio, mes] = periodo.split('-').map(Number);
      const resumen = await calculador.procesarEvaluacionesDepartamento(departamentos[0], anio, mes);
      registrar(JSON.stringify({ etapa: 'EVALUACION', periodo, empleadosEvaluados: resumen.empleadosEvaluados, empleadosSinDatos: resumen.empleadosSinDatos, errores: resumen.errores }));
      if (resumen.errores.length) throw new Error(`Evaluacion ${periodo}: algunos empleados no pudieron calcularse. Revisa el registro y repite.`);
    }
  } finally {
    try {
      if (bloqueado) await conexion.query("SELECT RELEASE_LOCK('rrhh_kpi_bodega_diario')");
    } finally { await conexion.release(); }
  }
}
