/** Componentes del valor diario; no son resultados de evaluación. */
export interface DesgloseOrigen {
  origen: 'FACTURAS' | 'TRASLADOS';
  valor: string;
}
