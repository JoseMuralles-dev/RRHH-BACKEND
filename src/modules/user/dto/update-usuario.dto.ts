import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsInt, MaxLength, Min, ValidateIf } from 'class-validator';

export class UpdateUsuarioDto {
  // Keep the JSON boolean intact despite global implicit conversion.
  @Transform(({ obj, key }) => obj[key])
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEmail()
  @MaxLength(150)
  correo?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  idRol?: number;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(1)
  idEmpleado?: number | null;
}
