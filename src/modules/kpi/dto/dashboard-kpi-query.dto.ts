import {
  IsInt,
  Max,
  Min,
} from 'class-validator';

import { Type } from 'class-transformer';

export class DashboardKpiQueryDto {

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  anio!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes!: number;
}