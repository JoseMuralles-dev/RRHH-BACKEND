import { IsDateString, Matches } from 'class-validator';

export class ProcesarMetricasBodegaDto {

  @IsDateString(
    { strict: true },
    { message: 'fecha debe ser una fecha válida' },
  )
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fecha debe tener el formato YYYY-MM-DD',
  })
  fecha!: string;
}
