import { calcularVentas } from './ventas-calculo';
import { codigoSap, dec, periodoVentas, VENTAS } from './ventas-reglas';
const metricas = Object.entries(VENTAS).map(([codigoKpi, pesoPorcentaje], i) => ({ idMetrica: i+1, codigoKpi, pesoPorcentaje: String(pesoPorcentaje), metaObjetivo: codigoKpi === 'VEN_NUEVOS_CLIENTES' ? '4' : null })) as any;
const sap = { facturacionPeriodoConIVA: '10000', notasCreditoPeriodoConIVA: '45', ventasNetasAcumuladasConIVA: '19955', carteraDeudora: '1000', carteraMenor60: '800' } as any;
const metas = [{ periodoMes: 1, metaObjetivo: '10000' }, { periodoMes: 2, metaObjetivo: '10000' }] as any;
describe('Calculo Ventas', () => {
  it('no inventa nota mientras falten reglas', () => {
    const r = calcularVentas(sap, 2, metas, dec(3), metricas, []);
    expect(r.notaFinal).toBeNull();
    expect(r.resultados[0].puntos).toBe('34.8425');
    expect(r.resultados[2].puntos).toBe('7.5000');
    expect(r.resultados[3].estado).toBe('REGLA_PENDIENTE');
  });
  it('identifica meta mensual faltante y acumulado incompleto', () => {
    const r = calcularVentas(sap, 3, metas, dec(0), metricas, []);
    expect(r.resultados[0].estado).toBe('SIN_META');
    expect(r.resultados[1].estado).toBe('META_INCOMPLETA');
    expect(r.resultados[1].mesesFaltantes).toEqual([3]);
  });
  it('no asume 0 o 100 sin denominador', () => {
    const r = calcularVentas({ ...sap, facturacionPeriodoConIVA: '0', carteraDeudora: '0' }, 2, metas, dec(0), metricas, []);
    for (const i of [3,4]) { expect(r.resultados[i].valorObtenido).toBeNull(); expect(r.resultados[i].estado).toBe('SIN_DENOMINADOR'); }
  });
  it.each([['44.99','0.449900','5.0000'],['45','0.450000','5.0000'],['45.01','0.450100',null]])('respeta limite NC exacto %s', (nc, valor, puntos) => {
    const rangos = [{ idMetrica: 4, isActive: true, valorMinimo: '0', valorMaximo: '0.45', porcentajeCumplimiento: '100', puntosOtorgados: '5' }] as any;
    const r = calcularVentas({ ...sap, notasCreditoPeriodoConIVA: nc }, 2, metas, dec(4), metricas, rangos);
    expect(r.resultados[3].valorObtenido).toBe(valor); expect(r.resultados[3].puntos).toBe(puntos);
  });
  it('limita sobrecumplimiento y preserva signos negativos', () => {
    const r = calcularVentas({ ...sap, notasCreditoPeriodoConIVA: '-10000' }, 2, metas, dec(8), metricas, []);
    expect(r.resultados[0].puntos).toBe('35.0000'); expect(r.resultados[2].puntos).toBe('10.0000');
  });
  it.each([null, undefined, '', ' ', '12a', '-1'])('rechaza codigo %s', v => expect(codigoSap(v)).toBeNull());
  it('acepta cero solo explicito', () => expect(codigoSap(0)).toBe(0));
  it('corta el mes actual en Guatemala sin desplazamiento UTC', () => {
    expect(periodoVentas(2026, 9, 'America/Guatemala', new Date('2026-10-01T02:00:00Z')).fechaFin).toBe('2026-09-30');
    expect(() => periodoVentas(2026, 10, 'America/Guatemala', new Date('2026-10-01T02:00:00Z'))).toThrow();
  });
});
