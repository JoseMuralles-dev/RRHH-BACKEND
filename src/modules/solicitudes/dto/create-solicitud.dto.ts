import {
  IsDateString,
  IsOptional,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateSolicitudDto {

  @IsInt()
  @IsPositive()
  idTipoIncidencia!: number;


  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  fechaInicio?: string | null;


  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  fechaFin?: string | null;


  @IsOptional()
  @IsInt()
  @IsPositive()
  diasSolicitados?: number | null;


  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'El motivo no puede contener solo espacios' })
  @MaxLength(1000)
  motivo!: string;
}