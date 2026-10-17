import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt/jwt-auth.guard';
import { AnalizarIaDto } from '../dto/analizar-ia.dto';
import { AiInformesService } from '../services/ai-informes.service';

@Controller('ia')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly informes: AiInformesService) {}
  @Post('analizar')
  analizar(@Body() dto: AnalizarIaDto, @Req() req: { user: { idUsuario: number } }) {
    return this.informes.consultar(dto, req.user.idUsuario);
  }
  @Get('informes')
  listar(@Req() req: { user: { idUsuario: number } }) {
    return this.informes.listar(req.user.idUsuario);
  }
  @Get('informes/:id')
  obtener(@Param('id', ParseIntPipe) id: number, @Req() req: { user: { idUsuario: number } }) {
    return this.informes.obtener(id, req.user.idUsuario);
  }
}