import { IsEmail, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUsuarioDto {
  @IsNotEmpty({
    message: 'El correo es obligatorio',
  })
  @IsEmail({}, {
    message: 'El correo debe tener un formato válido',
  })
  correo!: string;

  @IsString()
  @MinLength(6, {
    message: 'La contraseña debe tener al menos 6 caracteres',
  })
  password!: string;

  @IsNotEmpty({
    message: 'El rol es obligatorio',
  })
  @IsInt({
    message: 'El ID de rol debe ser un número',
  })
  idRol!: number;

  @IsOptional()
  @IsInt()
  idEmpleado?: number;
}