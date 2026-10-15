import { INSPECCIONES_REQUERIDAS } from './cinco-s.reglas';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class GuardarCincoSDto {
  @IsInt() @Min(1) idDepartamento!: number;
  @IsInt() @Min(1) @Max(INSPECCIONES_REQUERIDAS) numero!: number;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) fecha!: string;
  @IsString() @MinLength(1) @MaxLength(100) sucursal!: string;
  @IsString() @MinLength(1) @MaxLength(150) encargado!: string;
  @IsArray() @ArrayMinSize(20) @ArrayMaxSize(20)
  @IsInt({ each: true }) @Min(0, { each: true }) @Max(5, { each: true }) puntos!: number[];
  @IsOptional() @IsString() @MaxLength(5000) observaciones?: string;
}
