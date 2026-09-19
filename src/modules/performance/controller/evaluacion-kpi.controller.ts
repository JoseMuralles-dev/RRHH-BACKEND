import { Body, Controller, Post } from '@nestjs/common';
import { ProcesarEvaluacionMensualDto } from '../dto/procesar-evaluacion-mensual.dto';
import { EvaluacionKpiService } from '../services/evaluacion-kpi.service';

@Controller('performance/evaluaciones')
export class EvaluacionKpiController {
  constructor(private readonly evaluacionKpiService: EvaluacionKpiService) {}

  @Post('mensual')
  procesarEvaluacionMensual(@Body() dto: ProcesarEvaluacionMensualDto) {
    return this.evaluacionKpiService.procesarEvaluacionesDepartamento(
      dto.idDepartamento,
      dto.anio,
      dto.mes,
    );
  }
}
