import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt/jwt-auth.guard';
import { ConsultarDashboardKpiDto } from './dto/consultar-dashboard-kpi.dto';
import { ProcesarEvaluacionMensualDto } from '../performance/dto/procesar-evaluacion-mensual.dto';
import { KpiService } from './service/kpi.service';

@Controller('kpi')
@UseGuards(JwtAuthGuard)
export class KpiController {

  constructor(
    private readonly kpiService: KpiService,
  ) {}

  @Get('mi-dashboard')
  obtenerMiDashboard(
    @Req()
    request: {
      user: {
        idEmpleado?: number | null;
      };
    },

    @Query()
    consulta: ConsultarDashboardKpiDto,
  ) {
    return this.kpiService.obtenerDashboard(
      request.user.idEmpleado,
      consulta.anio,
      consulta.mes,
    );
  }
  @Get('mi-equipo')
obtenerDashboardEquipo(
  @Req()
  request: {
    user: {
      idEmpleado?: number | null;
      nivelJerarquico?: number;
    };
  },

  @Query()
  consulta: ConsultarDashboardKpiDto,
) {
   console.log('USUARIO JWT:', request.user);
  return this.kpiService.obtenerDashboardEquipo(
    request.user.idEmpleado,
    request.user.nivelJerarquico,
    consulta.anio,
    consulta.mes,
  );
}
}