import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ActualizarDocumentoDto {
  @IsOptional()
  @IsDateString()
  fechaDocumento?: string;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  estado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string;
}