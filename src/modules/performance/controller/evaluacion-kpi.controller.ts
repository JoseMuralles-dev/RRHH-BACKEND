import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';

import { EvaluacionKpiService } from '../services/evaluacion-kpi.service';
import { ProcesarEvaluacionMensualDto } from '../dto/procesar-evaluacion-mensual.dto';
import { ProcesarDepartamentoDto } from '../dto/procesar-departamento.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles/roles.guard';
import { MinLevel } from '../../../common/decorators/min-level/min-level.decorator';

@Controller('performance/evaluaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@MinLevel(3)
export class EvaluacionKpiController {

  constructor(
    private readonly evaluacionKpiService:
      EvaluacionKpiService,
  ) {}

  @Post('mensual')
  procesarDepartamento(@Body() dto: ProcesarDepartamentoDto) {
    return this.evaluacionKpiService.procesarEvaluacionesDepartamento(dto.idDepartamento, dto.anio, dto.mes);
  }

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
