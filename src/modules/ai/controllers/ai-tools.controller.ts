import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles/roles.guard';
import { MinLevel } from '../../../common/decorators/min-level/min-level.decorator';
import {
  ConsultarEmpleadoDto,
  ConsultarEquipoDto,
  ConsultarHistoricoEmpleadoDto,
  ConsultarHistoricoEquipoDto,
  ConsultarSerieMetricaDto,
} from '../dto/consultar-analitica.dto';
import type { UsuarioAnalitico } from '../interfaces/ai-context.interface';
import { AiToolsService } from '../services/ai-tools.service';

@Controller('ai-tools')
@UseGuards(JwtAuthGuard, RolesGuard)
@MinLevel(1)
export class AiToolsController {
  constructor(private readonly tools: AiToolsService) {}

  @Post('resumen-equipo')
  @HttpCode(HttpStatus.OK)
  @MinLevel(2)
  obtenerResumenEquipo(
    @Body() dto: ConsultarEquipoDto,
    @Req() req: { user: UsuarioAnalitico },
  ) {
    return this.tools.obtenerResumenEquipo(dto, req.user);
  }

  @Post('metricas-empleado')
  @HttpCode(HttpStatus.OK)
  obtenerMetricasEmpleado(
    @Body() dto: ConsultarEmpleadoDto,
    @Req() req: { user: UsuarioAnalitico },
  ) {
    return this.tools.obtenerMetricasEmpleado(dto, req.user);
  }

  @Post('serie-metrica-empleado')
  @HttpCode(HttpStatus.OK)
  obtenerSerieMetricaEmpleado(
    @Body() dto: ConsultarSerieMetricaDto,
    @Req() req: { user: UsuarioAnalitico },
  ) {
    return this.tools.obtenerSerieMetricaEmpleado(dto, req.user);
  }

  @Post('historico-equipo')
  @HttpCode(HttpStatus.OK)
  @MinLevel(2)
  obtenerHistoricoEquipo(
    @Body() dto: ConsultarHistoricoEquipoDto,
    @Req() req: { user: UsuarioAnalitico },
  ) {
    return this.tools.obtenerHistoricoEquipo(dto, req.user);
  }

  @Post('historico-empleado')
  @HttpCode(HttpStatus.OK)
  obtenerHistoricoEmpleado(
    @Body() dto: ConsultarHistoricoEmpleadoDto,
    @Req() req: { user: UsuarioAnalitico },
  ) {
    return this.tools.obtenerHistoricoEmpleado(dto, req.user);
  }
}
