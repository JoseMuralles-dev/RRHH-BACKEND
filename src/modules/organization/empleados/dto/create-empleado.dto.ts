import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEmpleadoDto {
  @IsInt()
  @Min(1)
  idPuesto!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  idJefeDirecto?: number | null;

  @IsOptional()
  @IsInt()
  codigoSapEmpleado?: number | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  primerNombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  segundoNombre?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  primerApellido!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  segundoApellido?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(13)
  dpi!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  igss!: string;

  @IsDateString()
  fechaNacimiento!: string;

  @IsDateString()
  fechaIngreso!: string;

  @IsNumberString()
  sueldoActual!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string | null;

  @IsOptional()
  @IsString()
  direccion?: string | null;
}
