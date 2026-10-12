import { BadRequestException } from '@nestjs/common';

export function calcularInspeccion(puntos: number[]) {
  if (!Array.isArray(puntos) || puntos.length !== 20 ||
      puntos.some(p => !Number.isInteger(p) || p < 0 || p > 5)) {
    throw new BadRequestException('Debe calificar los 20 criterios con enteros de 0 a 5.');
  }
  const categorias = Array.from({ length: 5 }, (_, i) =>
    puntos.slice(i * 4, i * 4 + 4).reduce((a, b) => a + b, 0));
  return { categorias, total: categorias.reduce((a, b) => a + b, 0) };
}

export function resumenCincoS(inspecciones: { puntos: number[] }[]) {
  const totales = inspecciones.map(i => calcularInspeccion(i.puntos).total);
  const completo = totales.length === 2;
  const suma = totales.reduce((a, b) => a + b, 0);
  // Enteros / 2 y enteros / 10: no hay redondeos ni conversión a rangos.
  return {
    inspeccionesRegistradas: totales.length, inspeccionesRequeridas: 2,
    completo, pesoPorcentaje: 20,
    promedio: completo ? suma / 2 : null,
    puntosKpi: completo ? suma / 10 : null,
  };
}
