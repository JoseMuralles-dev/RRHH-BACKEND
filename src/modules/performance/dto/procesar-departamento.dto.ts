import { Type } from 'class-transformer';
import { IsInt, Min, Max } from 'class-validator';

export class ProcesarDepartamentoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idDepartamento!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  anio!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes!: number;
}
