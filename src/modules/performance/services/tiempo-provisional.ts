// Politica temporal acordada: no representa horas ni cumplimiento medido.
// Al finalizarla, establecer HASTA inclusive para conservar el criterio historico.
export const TIEMPO_PROVISIONAL_DESDE = 202608;
export const TIEMPO_PROVISIONAL_HASTA: number | null = null;
export const CODIGO_TIEMPO = 'BOD_TIEMPO_PREP';
export const MOTIVO_TIEMPO_PROVISIONAL = '25% asignado provisionalmente mientras se implementa y valida la medicion del tiempo efectivo, pausas y periodos no laborales. No representa horas trabajadas verificadas. Criterio vigente desde agosto de 2026.';

export function tiempoProvisionalVigente(anio: number, mes: number): boolean {
  const periodo = anio * 100 + mes;
  return periodo >= TIEMPO_PROVISIONAL_DESDE && (TIEMPO_PROVISIONAL_HASTA === null || periodo <= TIEMPO_PROVISIONAL_HASTA);
}

export function resultadoTiempoProvisional() {
  return {
    // Identificadores virtuales: no se inserta un registro de medicion ficticio.
    idResultado: 0, idMetrica: -1, codigo: CODIGO_TIEMPO,
    nombre: 'Tiempo efectivo (asignacion provisional)', unidadMedida: null,
    valorObtenido: null, metaAplicada: null, porcentajeCumplimiento: null,
    pesoPorcentaje: 25, aportePorcentaje: 25, puntosObtenidos: 25,
    asignacionProvisional: true, observacion: MOTIVO_TIEMPO_PROVISIONAL, detalles: [],
  };
}
