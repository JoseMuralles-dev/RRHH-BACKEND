import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt/jwt-auth.guard';
import { ConsultarDashboardKpiDto } from '../dto/consultar-dashboard-kpi.dto';
import { GuardarCincoSDto } from './cinco-s.dto';
import { CincoSService, UsuarioCincoS } from './cinco-s.service';

@Controller('kpi/cinco-s')
@UseGuards(JwtAuthGuard)
export class CincoSController {
  constructor(private readonly service: CincoSService) {}
  @Get('catalogo') catalogo(@Req() req: { user: UsuarioCincoS }) { return this.service.catalogo(req.user); }
  @Get(':idDepartamento') consultar(
    @Param('idDepartamento', ParseIntPipe) id: number,
    @Query() query: ConsultarDashboardKpiDto, @Req() req: { user: UsuarioCincoS },
  ) { return this.service.consultar(id, query.anio, query.mes, req.user); }
  @Post() guardar(@Body() dto: GuardarCincoSDto, @Req() req: { user: UsuarioCincoS }) {
    return this.service.guardar(dto, req.user);
  }
  @Post(':idDepartamento/recalcular')
recalcular(
  @Param(
    'idDepartamento',
    ParseIntPipe,
  )
  idDepartamento: number,

  @Query()
  query: ConsultarDashboardKpiDto,

  @Req()
  req: {
    user: UsuarioCincoS;
  },
) {
  return this.service.recalcular(
    idDepartamento,
    query.anio,
    query.mes,
    req.user,
  );
}
}
