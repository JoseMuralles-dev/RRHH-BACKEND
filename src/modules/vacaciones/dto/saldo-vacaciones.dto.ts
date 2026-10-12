import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class PaginaVacacionesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) pagina = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 20;
}
export class CalendarioVacacionesDto extends PaginaVacacionesDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) desde!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) hasta!: string;
}
// Importes como cadenas decimales explícitas para conservar exactitud.
export class GuardarPeriodoDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) fechaInicio!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) fechaFin!: string;
  @IsString() @Matches(/^\d{1,4}(\.\d{1,2})?$/) diasAsignados!: string;
  @IsString()
  @Matches(/^\d{1,4}(\.\d{1,2})?$/)
  diasUtilizadosIniciales!: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) fechaCorteInicial?:
    string | null;
  @IsOptional() @IsString() @MaxLength(500) observaciones?: string | null;
}
export class AjusteVacacionesDto {
  @IsIn(['AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO']) tipoMovimiento!:
    'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO';
  @IsString() @Matches(/^\d{1,4}(\.\d{1,2})?$/) dias!: string;
  @IsString() @Matches(/\S/) @MaxLength(500) motivo!: string;
}

export class TablaSaldosDto extends PaginaVacacionesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) idEmpleado?: number;
  @IsOptional() @IsString() @MaxLength(100) buscar?: string;
  @IsOptional() @IsIn(['nombre', 'saldo', 'inicio']) orden: 'nombre' | 'saldo' | 'inicio' = 'nombre';
  @IsOptional() @IsIn(['ASC', 'DESC']) direccion: 'ASC' | 'DESC' = 'ASC';
}
