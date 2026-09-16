import {
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePuestoDto {
  @IsInt()
  @Min(1)
  idDepartamento!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombrePuesto!: string;

  @IsNumberString()
  salarioBase!: string;
}
