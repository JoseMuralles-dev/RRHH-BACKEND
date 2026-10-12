export class NotificacionResponseDto {
  idNotificacion!: number;

  tipo!: string;

  titulo!: string;

  mensaje!: string;

  referenciaTipo!: string | null;

  referenciaId!: number | null;

  leida!: boolean;

  fechaLectura!: Date | null;

  createdAt!: Date;
}