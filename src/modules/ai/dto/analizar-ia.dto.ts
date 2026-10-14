import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AnalizarIaDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  mes!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(1500)
  pregunta!: string;
}