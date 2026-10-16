import { IsIn, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MODULOS_USO } from './uso-reglas';
export class EntradaModuloDto {
  @IsIn(MODULOS_USO) modulo!: string;
  @IsUUID('4') eventoId!: string;
}
export class ConsultaUsoDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) desde!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) hasta!: string;
  @IsOptional() @IsIn(MODULOS_USO) modulo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) idUsuario?: number;
}
