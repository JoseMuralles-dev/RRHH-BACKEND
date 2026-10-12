import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SubirDocumentoDto {
  @Type(() => Number)
  @IsInt()
  idTipoDocumento!: number;

  @IsOptional()
  @IsDateString()
  fechaDocumento?: string;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string;
}