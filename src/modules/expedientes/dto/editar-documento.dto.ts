import { IsDateString, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class EditarDocumentoDto {
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaDocumento?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaVencimiento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string;
}
