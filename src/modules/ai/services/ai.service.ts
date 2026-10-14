import {
  BadGatewayException,
  Injectable,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { AnalizarIaDto } from '../dto/analizar-ia.dto';

interface UsuarioIa {
  idUsuario: number;
  idEmpleado?: number;
  nivelJerarquico?: number;
  correo?: string;
}

@Injectable()
export class AiService {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  async analizar(
    dto: AnalizarIaDto,
    usuario: UsuarioIa,
  ) {
    const webhook =
      this.configService.get<string>(
        'N8N_AI_WEBHOOK',
      );

    const tokenInterno =
      this.configService.get<string>(
        'N8N_INTERNAL_TOKEN',
      );

    if (!webhook || !tokenInterno) {
      throw new BadGatewayException(
        'La integración con IA no está configurada.',
      );
    }

    const response = await fetch(webhook, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': tokenInterno,
      },

      body: JSON.stringify({
        tipo: 'ANALISIS_KPI',

        usuario: {
          idUsuario: usuario.idUsuario,
          idEmpleado: usuario.idEmpleado ?? null,
          nivelJerarquico:
            usuario.nivelJerarquico ?? null,
          correo: usuario.correo ?? null,
        },

        periodo: {
          anio: dto.anio,
          mes: dto.mes,
        },

        pregunta: dto.pregunta,
      }),
    });

    if (!response.ok) {
      throw new BadGatewayException(
        'No fue posible obtener respuesta de la IA.',
      );
    }

    return response.json();
  }
}