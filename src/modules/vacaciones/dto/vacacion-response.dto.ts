import { EstadoSolicitud } from '../../solicitudes/enums/estado-solicitud.enum';

export class VacacionResponseDto {
  idSolicitud!: number;
  fechaInicio!: string | null;
  fechaFin!: string | null;
  diasSolicitados!: number | null;
  motivo!: string;
  estadoSolicitud!: EstadoSolicitud;
  fechaResolucion!: Date | null;
  nombreTipo!: string;
}

export class MisVacacionesResponseDto {
  anio!: number;
  pendientes!: VacacionResponseDto[];
  aprobadas!: VacacionResponseDto[];
  rechazadas!: VacacionResponseDto[];
  canceladas!: VacacionResponseDto[];
}
