import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateDepartamentoDto {

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)

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
