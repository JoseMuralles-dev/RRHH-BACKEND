import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles/roles.guard';
import { MinLevel } from '../../../common/decorators/min-level/min-level.decorator';
import { ConsultarMetricasEquipoDto } from '../dto/consultar-metricas-equipo.dto';
import { AiToolsService } from '../services/IA-tools.service';

@Controller('ia/tools')
@UseGuards(JwtAuthGuard, RolesGuard)
@MinLevel(3)
export class AiToolsController {
  constructor(private readonly aiToolsService: AiToolsService) {}

  @Get('metricas-equipo')
  obtenerMetricasEquipo(@Query() dto: ConsultarMetricasEquipoDto) {
    return this.aiToolsService.obtenerMetricasEquipo(
      dto.idEncargado,
      dto.anio,
      dto.mes,
    );
  }
}
