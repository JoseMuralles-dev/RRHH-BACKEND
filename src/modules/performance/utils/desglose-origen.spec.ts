import { agruparDesgloseMensual, crearDesglose, sumarDesglose } from './desglose-origen';

describe('Desglose por origen', () => {
  it('reconcilia los componentes del ejemplo sin perder centésimas', () => {
    expect(sumarDesglose(crearDesglose('37788.25', '84550.95'))).toBe('122339.20');
  });

  it('agrupa por origen en vez de generar una fila por día', () => {
    expect(agruparDesgloseMensual([
      { valor: '0.30', desgloseOrigen: crearDesglose('0.10', '0.20') },
      { valor: '0.70', desgloseOrigen: crearDesglose('0.30', '0.40') },
    ])).toEqual([
      { origen: 'FACTURAS', valor: '0.40' },
      { origen: 'TRASLADOS', valor: '0.60' },
    ]);
  });

  it('no presenta un desglose incompleto como total mensual', () => {
    expect(agruparDesgloseMensual([
      { valor: '1.00', desgloseOrigen: crearDesglose(1, 0) },
      { valor: '2.00', desgloseOrigen: null },
    ])).toBeNull();
  });

  it('rechaza valores faltantes o inválidos en SAP', () => {
    for (const valor of [undefined, null, '', NaN, Infinity, -1]) {
      expect(() => crearDesglose(valor, 0)).toThrow();
    }
  });

  it('rechaza diferencias entre el total diario y sus componentes', () => {
    expect(() => agruparDesgloseMensual([
      { valor: '5.00', desgloseOrigen: crearDesglose(1, 2) },
    ])).toThrow('no coincide');
  });
});
