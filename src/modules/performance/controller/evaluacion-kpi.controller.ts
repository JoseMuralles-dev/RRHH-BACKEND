import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { EvaluacionKpiService } from '../services/evaluacion-kpi.service';
import { ProcesarEvaluacionMensualDto } from '../dto/procesar-evaluacion-mensual.dto';

@Controller('performance/evaluaciones')
export class EvaluacionKpiController {

  constructor(
    private readonly evaluacionKpiService:
      EvaluacionKpiService,
  ) {}

  @Post('procesar')
  procesarEvaluacion(
    @Body()
    dto: ProcesarEvaluacionMensualDto,
  ) {

    return this.evaluacionKpiService
      .procesarEvaluacionMensual(
        dto.idEmpleado,
        dto.idDepartamento,
        dto.anio,
        dto.mes,
      );
  }
}