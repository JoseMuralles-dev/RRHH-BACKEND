export class ResultadoDashboardKpiDto {
  idResultado!: number;
  idMetrica!: number;
  codigo!: string | null;
  nombre!: string | null;
  unidadMedida!: string | null;
  valorObtenido!: number;
  metaAplicada!: number | null;
  porcentajeCumplimiento!: number | null;
  puntosObtenidos!: number;
  observacion!: string | null;
  detalles!: { origen: string; valor: number; descripcion: string | null }[];
}

export class EvaluacionDashboardKpiDto {
  idEvaluacion!: number;
  idDepartamento!: number;
  estado!: string;
  puntajeBase!: number;
  penalizacionTotal!: number;
  notaFinal!: number;
  metaGlobal!: number | null;
  calculadaEn!: Date;
  resultados!: ResultadoDashboardKpiDto[];
}

export class SerieDiariaKpiDto {
  idMetrica!: number;
  codigo!: string | null;
  nombre!: string | null;
  unidadMedida!: string | null;
  puntos!: { fecha: string; valor: number }[];
}

export class DashboardKpiResponseDto {
  idEmpleado!: number;
  periodo!: { anio: number; mes: number; fechaInicial: string; fechaFinal: string };
  tieneDatos!: boolean;
  ultimaCargaDiaria!: Date | null;
  diasConDatos!: number;
  evaluaciones!: EvaluacionDashboardKpiDto[];
  seriesDiarias!: SerieDiariaKpiDto[];
}
