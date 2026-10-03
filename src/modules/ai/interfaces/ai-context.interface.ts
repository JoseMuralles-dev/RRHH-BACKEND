// Subconjunto del principal autenticado por JwtStrategy. Nunca se recibe del body.
export interface UsuarioAnalitico {
  idUsuario: number;
  idEmpleado: number | null;
  nivelJerarquico: number;
}

export interface PeriodoAnalitico {
  anio: number;
  mes: number;
  fechaInicial: string;
  fechaFinal: string;
}

export interface EmpleadoAnalitico {
  idEmpleado: number;
  idDepartamento: number | null;
}

export interface ContextoMetrica {
  idMetrica: number;
  idDepartamento: number;
  codigoKpi: string;
  nombreKpi: string;
  unidadMedida: string;
  metaObjetivo: number | null;
  tipoCalculo: string;
  activa: boolean;
}

export interface AgregadoMensual {
  idEmpleado: number;
  idMetrica: number;
  periodo: string;
  total: number;
  promedioDiario: number;
  minimo: number;
  maximo: number;
  diasConDatos: number;
}
