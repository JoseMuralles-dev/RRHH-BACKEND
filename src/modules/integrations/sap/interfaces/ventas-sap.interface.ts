export interface VentasSap {
  slpCode: number | string; vendedor: string; fechaInicio: string | Date; fechaFin: string | Date;
  facturacionPeriodoConIVA: string | number; notasCreditoPeriodoConIVA: string | number;
  ventasNetasPeriodoConIVA: string | number; ventasNetasAcumuladasConIVA: string | number;
  porcentajeNotasCredito: string | number | null; carteraDeudora: string | number;
  saldosAFavor: string | number; saldoNeto: string | number;
  carteraMenor60: string | number; cartera60OMas: string | number;
  porcentajeCarteraMenor60: string | number | null;
}
