import { Body, Controller, Get, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles/roles.guard';
import { MinLevel } from '../../../common/decorators/min-level/min-level.decorator';
import { VentasService } from './ventas.service';
import { ConsultaClientesVentasDto, ClientesVentasDto, ConsultaMetasVentasDto, GuardarVentasDto, MetaVentasDto, PeriodoVentasDto } from './ventas.dto';
@Controller('kpi/ventas')
@UseGuards(JwtAuthGuard, RolesGuard)
@MinLevel(1)
export class VentasController {
  constructor(private readonly ventas: VentasService) {}
  @Get('empleados') empleados(@Req() req: any) { return this.ventas.empleadosDisponibles(req.user.idUsuario); }
  @Get('nuevos-clientes') clientesDia(@Req() req: any, @Query() q: ConsultaClientesVentasDto) { return this.ventas.clientesDia(req.user.idUsuario, q.idEmpleado, q.fecha); }
  @Get('mi-dashboard') propio(@Req() req: any, @Query() q: PeriodoVentasDto) { return this.ventas.dashboard(req.user.idUsuario, q.anio, q.mes); }
  @Get('equipo') @MinLevel(2) equipo(@Req() req: any, @Query() q: PeriodoVentasDto) { return this.ventas.dashboard(req.user.idUsuario, q.anio, q.mes, true); }
  @Get('metas') metas(@Req() req: any, @Query() q: ConsultaMetasVentasDto) { return this.ventas.metas(req.user.idUsuario, q.anio, q.mes, q.idEmpleado); }
  @Put('metas') @MinLevel(3) meta(@Req() req: any, @Body() dto: MetaVentasDto) { return this.ventas.guardarMeta(req.user.idUsuario, dto); }
  @Put('nuevos-clientes') @MinLevel(2) clientes(@Req() req: any, @Body() dto: ClientesVentasDto) { return this.ventas.clientes(req.user.idUsuario, dto); }
  @Post('evaluaciones') @MinLevel(2) guardar(@Req() req: any, @Body() dto: GuardarVentasDto) { return this.ventas.guardar(req.user.idUsuario, dto.idEmpleado, dto.anio, dto.mes); }
}
