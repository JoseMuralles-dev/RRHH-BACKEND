import { DesgloseOrigen } from '../interfaces/desglose-origen.interface';

// Trabajar en centésimas mantiene la igualdad entre el total y sus componentes.
export function centesimas(valor: unknown): number {
  if ((typeof valor !== 'number' && typeof valor !== 'string') ||
      String(valor).trim() === '') {
    throw new Error('El valor del desglose debe ser numérico.');
  }
  const numero = Number(valor);
  const entero = Math.round(numero * 100);
  if (!Number.isFinite(numero) || !Number.isSafeInteger(entero) || numero < 0) {
    throw new Error('El valor del desglose debe ser finito y no negativo.');
  }
  return entero;
}

export function crearDesglose(facturas: unknown, traslados: unknown): DesgloseOrigen[] {
  return [
    { origen: 'FACTURAS', valor: (centesimas(facturas) / 100).toFixed(2) },
    { origen: 'TRASLADOS', valor: (centesimas(traslados) / 100).toFixed(2) },
  ];
}

export function sumarDesglose(desglose: DesgloseOrigen[]): string {
  const total = desglose.reduce((suma, item) => suma + centesimas(item.valor), 0);
  if (!Number.isSafeInteger(total) || total > 99999999999999) {
    throw new Error('El total excede la capacidad decimal(14,2).');
  }
  return (total / 100).toFixed(2);
}

export function agruparDesgloseMensual(
  registros: { valor?: string; desgloseOrigen?: DesgloseOrigen[] | null }[],
): DesgloseOrigen[] | null {
  // No presentar un desglose parcial como si explicara todo el mes.
  if (registros.some(registro => !registro.desgloseOrigen?.length)) return null;
  const totales = new Map<DesgloseOrigen['origen'], number>();
  for (const registro of registros) {
    const desglose = registro.desgloseOrigen!;
    if (desglose.length !== 2 || new Set(desglose.map(item => item.origen)).size !== 2 ||
        desglose.some(item => !['FACTURAS', 'TRASLADOS'].includes(item.origen))) {
      throw new Error('El desglose debe contener FACTURAS y TRASLADOS una sola vez.');
    }
    if (centesimas(sumarDesglose(desglose)) !== centesimas(registro.valor)) {
      throw new Error('El desglose diario no coincide con el valor de la métrica.');
    }
    for (const item of desglose) {
      totales.set(item.origen, (totales.get(item.origen) ?? 0) + centesimas(item.valor));
    }
  }
  const mensual = [...totales].map(([origen, valor]) => ({ origen, valor: (valor / 100).toFixed(2) }));
  sumarDesglose(mensual);
  return mensual;
}
