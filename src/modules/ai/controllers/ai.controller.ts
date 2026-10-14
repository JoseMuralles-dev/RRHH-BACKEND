import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../../common/guards/jwt/jwt-auth.guard';
import { AnalizarIaDto } from '../dto/analizar-ia.dto';
import { AiService } from '../services/ai.service';

interface UsuarioIa {
  idUsuario: number;
  idEmpleado?: number;
  nivelJerarquico?: number;
  correo?: string;
}

@Controller('ia')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
  ) {}

  @Post('analizar')
  analizar(
    @Body() dto: AnalizarIaDto,
    @Req() req: { user: UsuarioIa },
  ) {
    return this.aiService.analizar(
      dto,
      req.user,
    );
  }
}