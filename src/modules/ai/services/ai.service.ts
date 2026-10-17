import { BadGatewayException, GatewayTimeoutException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AnalizarIaDto } from '../dto/analizar-ia.dto';
import type { UsuarioAnalitico } from '../interfaces/ai-context.interface';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  constructor(private readonly config: ConfigService) {}

  async analizar(dto: AnalizarIaDto, usuario: UsuarioAnalitico) {
    const webhook = this.config.get<string>('N8N_AI_WEBHOOK');
    const token = this.config.get<string>('N8N_INTERNAL_TOKEN');
    if (!webhook || !token) throw new BadGatewayException('La integración con IA no está configurada.');
    const configured = Number(this.config.get('N8N_AI_TIMEOUT_MS') ?? 90000);
    const timeout = Number.isFinite(configured) ? Math.max(1000, Math.min(120000, configured)) : 90000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(webhook, {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-Internal-Token': token },
        body: JSON.stringify({ tipo: 'ANALISIS_KPI', usuario,
          periodo: { anio: dto.anio, mes: dto.mes }, pregunta: dto.pregunta }),
      });
      if (!response.ok) {
        this.logger.warn('n8n devolvió HTTP ' + response.status);
        throw new BadGatewayException('El servicio de IA no pudo completar la consulta. Intenta nuevamente.');
      }
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || !('ok' in data) || data.ok !== true ||
          !('respuesta' in data) || typeof data.respuesta !== 'string' ||
          !data.respuesta.trim() || data.respuesta.length > 50000) {
        throw new BadGatewayException('El servicio de IA devolvió una respuesta inválida.');
      }
      return { ok: true as const, respuesta: data.respuesta.trim(), periodo: { anio: dto.anio, mes: dto.mes } };
    } catch (error) {
      if (controller.signal.aborted) throw new GatewayTimeoutException('La IA tardó demasiado. Intenta nuevamente.');
      if (error instanceof BadGatewayException) throw error;
      this.logger.warn('Fallo de conexión o formato de respuesta de n8n');
      throw new BadGatewayException('No fue posible comunicarse con el servicio de IA.');
    } finally { clearTimeout(timer); }
  }
}