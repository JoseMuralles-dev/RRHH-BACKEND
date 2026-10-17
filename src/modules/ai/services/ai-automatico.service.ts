import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { DataSource, MoreThanOrEqual } from 'typeorm';
import { Usuario } from '../../user/entities/user.entity';
import { EstadoUsuario } from '../../user/estado-usuario.enum';
import { NotificacionesService } from '../../notificaciones/notificaciones.service';
import { AiInforme } from '../entities/ai-informe.entity';
import { AiActorService } from './ai-actor.service';
import { AiInformesService } from './ai-informes.service';
import { AiToolsService } from './ai-tools.service';
import { AiService } from './ai.service';

export interface ResumenAutomatico {
  datosSuficientes: boolean;
  resumen: string;
  puntosClave: string[];
  recomendaciones: string[];
  fuentes: string[];
}
export function validarResumen(texto: string, fuente: string): ResumenAutomatico {
  let data: unknown;
  try { data = JSON.parse(texto.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')); }
  catch { throw new BadGatewayException('El informe automático no tiene el formato requerido'); }
  const d = data as ResumenAutomatico | null;
  const lista = (v: unknown, max: number) => Array.isArray(v) && v.length <= max &&
    v.every(x => typeof x === 'string' && x.trim().length > 0 && x.length <= 800);
  if (!d || typeof d.datosSuficientes !== 'boolean' || typeof d.resumen !== 'string' ||
      !d.resumen.trim() || d.resumen.length > 2000 || !lista(d.puntosClave, 5) ||
      !lista(d.recomendaciones, 5) || !lista(d.fuentes, 5) ||
      (d.datosSuficientes && (!d.puntosClave.length || !d.fuentes.includes(fuente)))) {
    throw new BadGatewayException('El informe automático está incompleto');
  }
  return d;
}

@Injectable()
export class AiAutomaticoService {
  private readonly logger = new Logger(AiAutomaticoService.name);
  constructor(private readonly db: DataSource, private readonly config: ConfigService,
    private readonly actores: AiActorService, private readonly informes: AiInformesService,
    private readonly tools: AiToolsService, private readonly ia: AiService,
    private readonly notificaciones: NotificacionesService) {}

  async ejecutar(anio: number, mes: number) {
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100 || !Number.isInteger(mes) || mes < 1 || mes > 12)
      throw new Error('Periodo inválido');
    if (this.config.get<string>('AI_NOTIFICACIONES_ENABLED') !== 'true') {
      return { habilitado: false, creados: 0, omitidos: 0, errores: 0 };
    }
    const limiteConfigurado = Number(this.config.get('AI_NOTIFICACIONES_MAX_POR_EJECUCION') ?? 20);
    const limite = Number.isInteger(limiteConfigurado) ? Math.max(1, Math.min(200, limiteConfigurado)) : 20;
    const usuarios = await this.db.getRepository(Usuario).find({
      where: { isActive: true, estado: EstadoUsuario.ACTIVO },
      select: { idUsuario: true, idEmpleado: true }, order: { idUsuario: 'ASC' },
    });
    const resultado = { habilitado: true, creados: 0, omitidos: 0, errores: 0 };
    let llamadas = 0;
    for (const usuario of usuarios) {
      if (!usuario.idEmpleado || llamadas >= limite) { resultado.omitidos++; continue; }
      try {
        const creado = await this.informes.exclusivo(usuario.idUsuario, async manager => {
          const actor = await this.actores.obtener(usuario.idUsuario);
          const alcance = await this.actores.alcance(actor);
          const repo = manager.getRepository(AiInforme);
          const hoy = new Date(); hoy.setUTCHours(0, 0, 0, 0);
          if (await repo.existsBy({ idUsuario: actor.idUsuario, origen: 'AUTOMATICO', createdAt: MoreThanOrEqual(hoy) })) return false;
          const equipo = actor.nivelJerarquico >= 2;
          const fuente = equipo ? 'resumen-equipo' : 'historico-empleado';
          const datos = equipo
            ? await this.tools.obtenerResumenEquipo({ idEncargado: actor.idEmpleado!, anio, mes }, actor)
            : await this.tools.obtenerHistoricoEmpleado({ idEmpleado: actor.idEmpleado!, anio, mes, cantidadMeses: 1 }, actor);
          const tieneDatos = 'empleados' in datos
            ? datos.empleados.some(e => e.tieneDatos)
            : datos.periodos.some(p => p.tieneDatos);
          if (!tieneDatos) return false;
          const deduplicacion = createHash('sha256').update(JSON.stringify({ version: 1, alcance, anio, mes, datos })).digest('hex');
          if (await repo.existsBy({ deduplicacion })) return false;
          const pregunta = 'Genera un informe administrativo de KPI del período indicado usando la herramienta ' + fuente +
            (equipo ? ' para mi equipo.' : ' para mi propio idEmpleado: ' + actor.idEmpleado + '.') +
            ' Devuelve exclusivamente JSON: {"datosSuficientes":true,"resumen":"...","puntosClave":["..."],"recomendaciones":["..."],"fuentes":["' + fuente + '"]}.' +
            ' Máximo 5 puntos y 5 recomendaciones. Los puntos son hechos observados; las recomendaciones son sugerencias para revisión humana.' +
            ' No inventes datos ni recalcules calificaciones oficiales. No confundas sumas o promedios descriptivos con cumplimiento oficial.' +
            ' Si falla una herramienta o faltan datos, usa datosSuficientes:false, puntosClave:[], recomendaciones:[], fuentes:[].' +
            ' No tomes decisiones laborales. Incluye los identificadores y período de los datos utilizados.';
          llamadas++;
          const respuesta = await this.ia.analizar({ anio, mes, pregunta }, actor);
          const resumen = validarResumen(respuesta.respuesta, fuente);
          if (!resumen.datosSuficientes) return false;
          if (await this.actores.alcance(await this.actores.obtener(actor.idUsuario)) !== alcance) return false;
          await manager.transaction(async tx => {
            const informes = tx.getRepository(AiInforme);
            const informe = await informes.save(informes.create({
              idUsuario: actor.idUsuario, alcance, anio, mes, origen: 'AUTOMATICO',
              pregunta: 'Resumen automático de KPI', respuesta: resumen.resumen,
              puntosClave: resumen.puntosClave, recomendaciones: resumen.recomendaciones,
              fuentes: resumen.fuentes, deduplicacion,
            }));
            await this.notificaciones.crear({
              idUsuarioDestinatario: actor.idUsuario, tipo: 'IA_KPI',
              titulo: 'Puntos clave de KPI · ' + mes + '/' + anio,
              mensaje: 'Hay ' + resumen.puntosClave.length + ' puntos clave para revisar. Abre el informe para ver los datos y las recomendaciones.',
              referenciaTipo: 'IA_INFORME', referenciaId: informe.idInforme,
            }, tx);
          });
          return true;
        });
        if (creado) resultado.creados++; else resultado.omitidos++;
      } catch (error) {
        resultado.errores++;
        // Solo estado; no registrar información de empleados ni contenido del modelo.
        this.logger.warn('Informe automático no generado para usuario ' + usuario.idUsuario +
          ' (' + (error instanceof BadGatewayException ? 'respuesta IA inválida' : 'revisar permisos, conectividad o base de datos') + ')');
      }
    }
    return resultado;
  }
}
