import { Body, Controller, Get, Header, HttpCode, Post, Query, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { MinLevel } from '../../common/decorators/min-level/min-level.decorator';
import { UsoService } from './uso.service';
import { ConsultaUsoDto, EntradaModuloDto } from './uso.dto';
interface Autenticado { user: {idUsuario:number;nivelJerarquico:number}; }
@Controller('uso')
@UseGuards(JwtAuthGuard,RolesGuard)
export class UsoController {
  constructor(private readonly uso:UsoService) {}
  @Post('entradas') @HttpCode(200) @MinLevel(1)
  async entrada(@Req() req:Autenticado,@Body() dto:EntradaModuloDto) {
    const registrado=await this.uso.registrar({idUsuario:req.user.idUsuario,nivelRol:req.user.nivelJerarquico,
      modulo:dto.modulo,accion:'ENTRADA_MODULO',origen:'NAVEGACION',metodo:'EVENTO',ruta:null,
      estadoHttp:200,exito:true,duracionMs:0,eventoCliente:dto.eventoId});
    if (!registrado) throw new ServiceUnavailableException('Registro de uso no disponible');
    return {registrado:true};
  }
  @Get('resumen') @MinLevel(4) @Header('Cache-Control','private, no-store')
  resumen(@Req() req:Autenticado,@Query() q:ConsultaUsoDto) {return this.uso.resumen(req.user.idUsuario,q);}
  @Get('recurrencia') @MinLevel(4) @Header('Cache-Control','private, no-store')
  recurrencia(@Req() req:Autenticado,@Query() q:ConsultaUsoDto) {return this.uso.recurrencia(req.user.idUsuario,q);}
}
