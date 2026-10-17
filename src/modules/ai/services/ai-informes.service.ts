import { ConflictException, HttpException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, EntityManager, MoreThanOrEqual } from 'typeorm';
import { AiInforme } from '../entities/ai-informe.entity';
import { AiActorService } from './ai-actor.service';
import { AiService } from './ai.service';
import type { AnalizarIaDto } from '../dto/analizar-ia.dto';

@Injectable()
export class AiInformesService {
  constructor(private readonly db: DataSource, private readonly actores: AiActorService,
    private readonly ia: AiService) {}

  async consultar(dto: AnalizarIaDto, idUsuario: number) {
    return this.exclusivo(idUsuario, async (manager) => {
      const actor = await this.actores.obtener(idUsuario);
      const alcance = await this.actores.alcance(actor);
      const repo = manager.getRepository(AiInforme);
      const recientes = await repo.countBy({ idUsuario, origen: 'CONSULTA', createdAt: MoreThanOrEqual(new Date(Date.now() - 3600000)) });
      if (recientes >= 20) throw new HttpException('Alcanzaste el límite de 20 consultas por hora.', 429);
      const respuesta = await this.ia.analizar(dto, actor);
      const actual = await this.actores.obtener(idUsuario);
      if (await this.actores.alcance(actual) !== alcance) throw new ConflictException('Tus permisos cambiaron. Inicia otra consulta.');
      const informe = await repo.save(repo.create({ idUsuario, alcance, anio: dto.anio, mes: dto.mes,
        origen: 'CONSULTA', pregunta: dto.pregunta, respuesta: respuesta.respuesta,
        puntosClave: null, recomendaciones: null, fuentes: null, deduplicacion: null }));
      return { ...respuesta, idInforme: informe.idInforme };
    });
  }

  async listar(idUsuario: number) {
    const alcance = await this.actores.alcance(await this.actores.obtener(idUsuario));
    return this.db.getRepository(AiInforme).find({ where: { idUsuario, alcance },
      select: { idInforme: true, anio: true, mes: true, origen: true, pregunta: true, createdAt: true },
      order: { idInforme: 'DESC' }, take: 50 });
  }

  async obtener(idInforme: number, idUsuario: number) {
    const alcance = await this.actores.alcance(await this.actores.obtener(idUsuario));
    const informe = await this.db.getRepository(AiInforme).findOne({ where: { idInforme, idUsuario, alcance } });
    if (!informe) throw new NotFoundException('Informe no disponible para tus permisos actuales.');
    const { deduplicacion: _deduplicacion, alcance: _alcance, idUsuario: _idUsuario, ...publico } = informe;
    return publico;
  }

  // Lock de conexión: evita llamadas simultáneas entre procesos, sin transacción HTTP abierta.
  async exclusivo<T>(idUsuario: number, action: (manager: EntityManager) => Promise<T>): Promise<T> {
    const runner = this.db.createQueryRunner();
    await runner.connect();
    const key = 'rrhh:ia:' + idUsuario;
    let locked = false;
    try {
      const rows: Array<{ adquirido: number | null }> = await runner.query('SELECT GET_LOCK(?, 0) AS adquirido', [key]);
      if (rows[0]?.adquirido === 0) throw new ConflictException('Ya hay un análisis en curso. Espera a que termine.');
      if (rows[0]?.adquirido !== 1) throw new ServiceUnavailableException('No fue posible iniciar el análisis.');
      locked = true;
      return await action(runner.manager);
    } finally {
      try { if (locked) await runner.query('SELECT RELEASE_LOCK(?)', [key]); }
      finally { await runner.release(); }
    }
  }
}
