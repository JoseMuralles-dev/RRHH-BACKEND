import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';

import { SapService } from './sap.service';

@Controller('sap')
export class SapController {

  constructor(
    private readonly sapService: SapService,
  ) {}

  @Get('bodega')
  obtenerBodega(
    @Query('fechaInicial') fechaInicial: string,
    @Query('fechaFinal') fechaFinal: string,
  ) {
    return this.sapService.obtenerMetricasBodega(
      fechaInicial,
      fechaFinal,
    );
  }
}