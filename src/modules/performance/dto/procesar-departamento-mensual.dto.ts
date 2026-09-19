import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class ProcesarDepartamentoMensualDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idDepartamento!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(9999)
  anio!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes!: number;
}
