import { IsInt, Max, Min } from 'class-validator';

export class ProcesarEvaluacionMensualDto {
  @IsInt()
  @Min(1)
  idDepartamento!: number;

  @IsInt()
  @Min(1000)
  @Max(9999)
  anio!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  mes!: number;
}
