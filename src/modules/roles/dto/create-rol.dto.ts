import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateRolDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  codigoRol!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nombreRol!: string;

  @IsInt()
  nivelJerarquico!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;
}
