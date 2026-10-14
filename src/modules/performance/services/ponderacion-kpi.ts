import { cumplimientoReal } from './cumplimiento-kpi';

/** Los nombres antiguos de columnas se conservan por compatibilidad. Son porcentajes. */
export function pesoKpi(codigo: string | null | undefined, configurado?: string | number | null): number {
  const bodega: Record<string, number> = { BOD_FACTURAS: 15, BOD_LINEAS: 15, BOD_ARTICULOS: 25, BOD_TIEMPO_PREP: 25 };
  if (codigo?.startsWith('DEP_5S_')) return 20;
  if (codigo && codigo in bodega) return bodega[codigo];
  const peso = Number(configurado);
  return Number.isFinite(peso) ? Math.min(100, Math.max(0, peso)) : 0;
}

export function aporteKpi(valor: string | number | null | undefined, meta: string | number | null | undefined,
  codigo?: string | null, peso?: string | number | null): number {
  const cumplimiento = cumplimientoReal(valor, meta, codigo);
  return Math.min(100, Math.max(0, cumplimiento ?? 0)) / 100 * pesoKpi(codigo, peso);
}
