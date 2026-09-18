import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';


import { SolicitudesService }from './solicitudes.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { ResolverAprobacionDto } from './dto/resolver-aprobacion.dto';
import { JwtAuthGuard } from '../../common/guards/jwt/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';


@Controller('solicitudes')
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
)
export class SolicitudesController {

  constructor(
    private readonly solicitudesService:
      SolicitudesService,
  ) {}


 
  // CREAR
  @Post()
  create(
    @Req() req: any,
    @Body() dto: CreateSolicitudDto,
  ) {

    return this.solicitudesService.create(
      req.user.idEmpleado,
      dto,
    );
  }


  // MIS SOLICITUDES

  @Get('mis-solicitudes')
  findMisSolicitudes(
    @Req() req: any,
  ) {

    return this.solicitudesService
      .findMisSolicitudes(
        req.user.idEmpleado,
      );
  }


  // PENDIENTES DE APROBAR

  @Get('pendientes-aprobacion')
  findPendientes(
    @Req() req: any,
  ) {

    return this.solicitudesService
      .findPendientesAprobacion(
        req.user.idUsuario,
      );
  }

    //APROBADAS
    @Get('aprobadas')
    findAprobadas(
      @Req() req: any,
    ) {
        return this.solicitudesService.findAprobadas(req.user.idUsuario);
    }

  
  // DETALLE

  @Get('tipos-incidencia')
  findTiposIncidencia() {
    return this.solicitudesService.findTiposIncidencia();
  }

  @Get(':id')
  findOne(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,

    @Req()
    req: any,
  ) {

    return this.solicitudesService.findOne(
      id,
      req.user,
    );
  }


  // APROBAR

  @Patch(':id/aprobar')
  aprobar(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,

    @Req()
    req: any,

    @Body()
    dto: ResolverAprobacionDto,
  ) {

    return this.solicitudesService.aprobar(
      id,
      req.user.idUsuario,
      dto,
    );
  }

  // RECHAZAR

  @Patch(':id/rechazar')
  rechazar(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,

    @Req()
    req: any,

    @Body()
    dto: ResolverAprobacionDto,
  ) {

    return this.solicitudesService.rechazar(
      id,
      req.user.idUsuario,
      dto,
    );
  }


  // CANCELAR

  @Patch(':id/cancelar')
  cancelar(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,

    @Req()
    req: any,
  ) {

    return this.solicitudesService.cancelar(
      id,
      req.user,
    );
  }
}