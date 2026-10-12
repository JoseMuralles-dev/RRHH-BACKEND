import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CrearExpedienteDto {
  @Type(() => Number)
  @IsInt()
  idEmpleado!: number;

  @IsDateString()
  fechaApertura!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string;
}