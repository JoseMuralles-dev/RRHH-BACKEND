export interface MetricaBodegaSap {
  CodigoPreparador: string;
  CodigoEmpleadoSap: string;
  NombrePreparador: string;

  CantidadFacturas: number;
  TotalLineas: number;
  TotalArticulos: number;
  PromedioTiempoPreparacionMinutos: number;

  CantidadTraslados: number;
  TotalLineasTraslados: number;
  TotalArticulosTraslados: number;
  PromedioTiempoTrasladoMinutos: number;
}