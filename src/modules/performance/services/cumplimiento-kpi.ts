/** El cumplimiento operativo es independiente de rangos, puntos y calificación. */
export function cumplimientoReal(valor: string | number | null | undefined, meta: string | number | null | undefined, codigo?: string | null): number | null {
  if (valor == null || meta == null || valor === '' || meta === '') return null;
  const resultado = Number(valor), objetivo = Number(meta);
  if (!Number.isFinite(resultado) || !Number.isFinite(objetivo) || resultado < 0 || objetivo <= 0) return null;
  // Un tiempo cero no permite calcular una razón inversa válida.
  if (codigo === 'BOD_TIEMPO_PREP' && resultado === 0) return null;
  const porcentaje = (codigo === 'BOD_TIEMPO_PREP' ? objetivo / resultado : resultado / objetivo) * 100;
  return Number.isFinite(porcentaje) ? porcentaje : null;
}
