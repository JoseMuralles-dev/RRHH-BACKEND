import { InternalServerErrorException } from '@nestjs/common';

// DECIMAL se convierte solo dentro del rango que conserva centesimas seguras.
export function numeroAnalitico(valor: string | number): number {
  const numero = Number(valor);
  if (
    (typeof valor !== 'string' && typeof valor !== 'number') ||
    String(valor).trim() === '' ||
    !Number.isFinite(numero) ||
    Math.abs(numero) > Number.MAX_SAFE_INTEGER / 100
  ) {
    throw new InternalServerErrorException(
      'Valor analitico fuera del rango numerico seguro',
    );
  }
  return numero;
}
