import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { MinLevel } from '../../common/decorators/min-level/min-level.decorator';
import { VacacionesGestionService } from './vacaciones-gestion.service';
import {
  AjusteVacacionesDto,
  CalendarioVacacionesDto,
  GuardarPeriodoDto,
  PaginaVacacionesDto, TablaSaldosDto,
} from './dto/saldo-vacaciones.dto';
interface Autenticado {
  user: { idUsuario: number };
}
@Controller('vacaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VacacionesGestionController {
  constructor(private readonly gestion: VacacionesGestionService) {}
  @Get('empleados-disponibles') @MinLevel(2)
  empleadosDisponibles(@Req() req: Autenticado) {
    return this.gestion.empleadosDisponibles(req.user.idUsuario);
  }
  @Get('saldos-tabla') @MinLevel(2)
  tablaSaldos(@Req() req: Autenticado, @Query() dto: TablaSaldosDto) {
    return this.gestion.tablaSaldos(req.user.idUsuario, dto);
  }
  @Get('mi-saldo') miSaldo(@Req() req: Autenticado) {
    return this.gestion.resumen(req.user.idUsuario);
  }
  @Get('mis-movimientos') misMovimientos(
    @Req() req: Autenticado,
    @Query() dto: PaginaVacacionesDto,
  ) {
    return this.gestion.movimientos(req.user.idUsuario, dto);
  }
  @Get('calendario/propio') calendario(
    @Req() req: Autenticado,
    @Query() dto: CalendarioVacacionesDto,
  ) {
    return this.gestion.calendario(req.user.idUsuario, dto);
  }
  @Get('calendario/equipo') @MinLevel(2) equipo(
    @Req() req: Autenticado,
    @Query() dto: CalendarioVacacionesDto,
  ) {
    return this.gestion.calendario(req.user.idUsuario, dto, true);
  }
  @Get('empleados/:id/saldo') saldo(
    @Req() req: Autenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.gestion.resumen(req.user.idUsuario, id);
  }
  @Get('empleados/:id/movimientos') movimientos(
    @Req() req: Autenticado,
    @Param('id', ParseIntPipe) id: number,
    @Query() dto: PaginaVacacionesDto,
  ) {
    return this.gestion.movimientos(req.user.idUsuario, dto, id);
  }
  @Get('empleados/:id/periodos') periodos(
    @Req() req: Autenticado,
    @Param('id', ParseIntPipe) id: number,
    @Query() dto: PaginaVacacionesDto,
  ) {
    return this.gestion.periodos(req.user.idUsuario, id, dto);
  }
  @Post('empleados/:id/periodos') @MinLevel(3) crear(
    @Req() req: Autenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GuardarPeriodoDto,
  ) {
    return this.gestion.guardarPeriodo(req.user.idUsuario, id, dto);
  }
  @Patch('empleados/:id/periodos/:periodo') @MinLevel(3) editar(
    @Req() req: Autenticado,
    @Param('id', ParseIntPipe) id: number,
    @Param('periodo', ParseIntPipe) periodo: number,
    @Body() dto: GuardarPeriodoDto,
  ) {
    return this.gestion.guardarPeriodo(req.user.idUsuario, id, dto, periodo);
  }
  @Post('empleados/:id/periodos/:periodo/ajustes') @MinLevel(3) ajustar(
    @Req() req: Autenticado,
    @Param('id', ParseIntPipe) id: number,
    @Param('periodo', ParseIntPipe) periodo: number,
    @Body() dto: AjusteVacacionesDto,
  ) {
    return this.gestion.ajustar(req.user.idUsuario, id, periodo, dto);
  }
}
