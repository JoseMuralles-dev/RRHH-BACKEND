import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateDepartamentoDto {

  @IsString({
    message: 'El nombre del departamento debe ser texto',
  })
  @IsNotEmpty({
    message: 'El nombre del departamento es obligatorio',
  })
  @MaxLength(100, {
    message: 'El nombre del departamento no puede exceder 100 caracteres',
  })
  nombreDepartamento!: string;

  @IsOptional()
  @IsString({
    message: 'La descripción debe ser texto',
  })
  descripcion?: string;
}