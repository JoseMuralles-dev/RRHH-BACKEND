import { Type } from 'class-transformer';
import { IsInt, Min, Max, IsOptional, IsString, Matches } from 'class-validator';
export class PeriodoVentasDto {
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) anio!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) mes!: number;
}
export class ConsultaMetasVentasDto extends PeriodoVentasDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) idEmpleado?: number;
}
export class MetaVentasDto extends PeriodoVentasDto {
  @Type(() => Number) @IsInt() @Min(1) idEmpleado!: number;
  @IsString() @Matches(/^\d{1,12}(\.\d{1,2})?$/) metaObjetivo!: string;
}
export class ClientesVentasDto {
  @Type(() => Number) @IsInt() @Min(1) idEmpleado!: number;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) fecha!: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000000) cantidad!: number;
}
export class GuardarVentasDto extends PeriodoVentasDto {
  @Type(() => Number) @IsInt() @Min(1) idEmpleado!: number;
}

export class ConsultaClientesVentasDto {
  @Type(() => Number) @IsInt() @Min(1) idEmpleado!: number;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) fecha!: string;
}
