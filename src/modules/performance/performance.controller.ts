import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { PerformanceService } from '../performance/services/performance.service';
import { ProcesarMetricasBodegaDto } from './../performance/dto/procesar-metricas-bodega.dto';

@Controller('performance')
export class PerformanceController {

  constructor(
    private readonly performanceService: PerformanceService,
  ) {}

  @Post('etl/bodega')
  procesarMetricasBodega(
    @Body() dto: ProcesarMetricasBodegaDto,
  ) {
    return this.performanceService.procesarMetricasBodega(
      dto.fecha,
    );
  }
}