import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ResolverAprobacionDto {

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comentario?: string;
}