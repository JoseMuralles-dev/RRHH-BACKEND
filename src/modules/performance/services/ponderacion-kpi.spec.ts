import { aporteKpi } from './ponderacion-kpi';

describe('Porcentajes ponderados', () => {
  it('75% de lineas aporta 11.25% y de libras aporta 18.75%', () => {
    expect(aporteKpi(75, 100, 'BOD_LINEAS')).toBe(11.25);
    expect(aporteKpi(75, 100, 'BOD_ARTICULOS')).toBe(18.75);
  });
  it('los cinco pesos suman 100% al alcanzar todas las metas', () => {
    const codigos = ['BOD_FACTURAS', 'BOD_LINEAS', 'BOD_ARTICULOS', 'BOD_TIEMPO_PREP', 'DEP_5S_3'];
    expect(codigos.reduce((total, codigo) => total + aporteKpi(100, 100, codigo), 0)).toBe(100);
  });
  it('superar la meta no supera el peso de la metrica', () => {
    expect(aporteKpi(200, 100, 'BOD_LINEAS')).toBe(15);
    expect(aporteKpi(10, 100, 'BOD_TIEMPO_PREP')).toBe(25);
  });
  it('no redondea el cumplimiento antes de ponderar', () => {
    expect(aporteKpi(1, 3, 'BOD_LINEAS')).toBeCloseTo(5, 14);
  });
  it('aplica el peso configurado a otros departamentos', () => {
    expect(aporteKpi(75, 100, 'VENTAS', '40')).toBe(30);
    expect(aporteKpi(0, 100, 'VENTAS', '40')).toBe(0);
    expect(aporteKpi(75, null, 'VENTAS', '40')).toBe(0);
  });
});
