import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ConsultarVacacionesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(9999)
  anio?: number;
}

// Permite que el ValidationPipe rechace parámetros ajenos en /proximas.
export class ConsultarProximasVacacionesDto {}
