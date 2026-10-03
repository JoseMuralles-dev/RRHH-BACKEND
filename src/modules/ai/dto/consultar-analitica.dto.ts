import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class PeriodoAnaliticoDto {
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

export class ConsultarEquipoDto extends PeriodoAnaliticoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  idEncargado!: number;
}

export class ConsultarEmpleadoDto extends PeriodoAnaliticoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  idEmpleado!: number;
}

export class ConsultarSerieMetricaDto extends ConsultarEmpleadoDto {
  @IsString()
  @MaxLength(50)
  @Matches(/\S/, { message: 'codigoKpi no puede estar vacio' })
  codigoKpi!: string;
}

export class ConsultarHistoricoEquipoDto extends ConsultarEquipoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  cantidadMeses = 3;
}

export class ConsultarHistoricoEmpleadoDto extends ConsultarEmpleadoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  cantidadMeses = 3;
}
