import { BadRequestException } from '@nestjs/common';

// Decimal fijo: seis decimales internos, redondeo solo al presentar/persistir.
const S = 1000000n;
export function dec(v: unknown): bigint {
  if (typeof v !== 'string' && typeof v !== 'number') throw new BadRequestException('Decimal ausente');
  const s = String(v);
  if (!/^-?\d+(\.\d{1,6})?$/.test(s)) throw new BadRequestException('Decimal invalido (maximo seis decimales)');
  const [a, b = ''] = s.replace('-', '').split('.');
  return (BigInt(a) * S + BigInt(b.padEnd(6, '0'))) * (s.startsWith('-') ? -1n : 1n);
}
export function texto(n: bigint, precision = 4): string {
  const negativo = n < 0n;
  const factor = 10n ** BigInt(6 - precision);
  const r = ((negativo ? -n : n) + factor / 2n) / factor;
  const unidad = 10n ** BigInt(precision);
  return `${negativo && r ? '-' : ''}${r / unidad}.${String(r % unidad).padStart(precision, '0')}`;
}
export const porcentaje = (valor: bigint, meta: bigint) => valor * 100n * S / meta;
export const aporte = (cumplimiento: bigint, peso: bigint) =>
  (cumplimiento < 0n ? 0n : cumplimiento > 100n * S ? 100n * S : cumplimiento) * peso / (100n * S);
export function codigoSap(v: unknown): number | null {
  if (v === null || v === undefined || !/^\d+$/.test(String(v))) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n <= 2147483647 ? n : null;
}
export function periodoVentas(anio: number, mes: number, zona = 'America/Guatemala', now = new Date()) {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100 || !Number.isInteger(mes) || mes < 1 || mes > 12)
    throw new BadRequestException('Periodo invalido');
  const prefijo = `${anio}-${String(mes).padStart(2, '0')}`;
  if (prefijo > hoy.slice(0, 7)) throw new BadRequestException('No se permiten periodos futuros');
  const provisional = prefijo === hoy.slice(0, 7);
  return { anio, mes, fechaInicio: `${prefijo}-01`, fechaFin: provisional ? hoy : `${prefijo}-${new Date(Date.UTC(anio, mes, 0)).getUTCDate()}`, provisional };
}
export const VENTAS = {
  VEN_META_MENSUAL: 35, VEN_META_ACUMULADA: 15, VEN_NUEVOS_CLIENTES: 10,
  VEN_NOTAS_CREDITO: 5, VEN_CARTERA_SANA: 35,
} as const;
export const CRITERIOS_VENTAS = [
  'Importes con IVA; DocTotal ya incluye impuestos. Se conservan signos de documentos cancelatorios.',
  'Antiguedad desde RefDate, no DueDate: menor a 60 comprende 0 a 59 dias.',
  'Cartera deudora positiva separada de saldos a favor.',
  'Cartera historica: reconstruccion de conciliaciones anuladas posteriormente pendiente de validacion.',
  'Nuevos clientes: cantidades declaradas; no se verifica unicidad de clientes.',
  'Cumplimiento limitado entre 0 y 100%, conforme a la politica existente; aportes limitados a su peso.',
];
