import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt/jwt-auth.guard';
import { ConsultarProximasVacacionesDto, ConsultarVacacionesDto } from './dto/consultar-vacaciones.dto';
import { VacacionesService } from './vacaciones.service';

interface SolicitudAutenticada { user: { idEmpleado?: number | null } }

@Controller('vacaciones')
@UseGuards(JwtAuthGuard)
export class VacacionesController {
  constructor(private readonly vacaciones: VacacionesService) {}

  @Get('mis-vacaciones')
  misVacaciones(@Req() request: SolicitudAutenticada, @Query() consulta: ConsultarVacacionesDto) {
    return this.vacaciones.misVacaciones(request.user.idEmpleado, consulta.anio);
  }

  @Get('proximas')
  proximas(@Req() request: SolicitudAutenticada, @Query() _consulta: ConsultarProximasVacacionesDto) {
    return this.vacaciones.proximas(request.user.idEmpleado);
  }

  @Get('historial')
  historial(@Req() request: SolicitudAutenticada, @Query() consulta: ConsultarVacacionesDto) {
    return this.vacaciones.historial(request.user.idEmpleado, consulta.anio);
  }
}
