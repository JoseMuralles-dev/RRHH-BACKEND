import { BadRequestException, ConflictException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Between, DataSource, EntityManager, In } from 'typeorm';
import { SapService } from '../../integrations/sap/sap.service';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { Usuario } from '../../user/entities/user.entity';
import { EstadoUsuario } from '../../user/estado-usuario.enum';
import { Departamento } from '../../organization/departamentos/entities/departamento.entity';
import { MetricaKpi } from '../../performance/entities/metrica-kpi.entity';
import { MetricaKpiDiaria } from '../../performance/entities/metrica-kpi-diaria.entity';
import { MetaKpiEmpleado } from '../../performance/entities/meta-kpi-empleado.entity';
import { RangoKpi } from '../../performance/entities/rango-kpi.entity';
import { KpiCambio } from '../../performance/entities/kpi-cambio.entity';
import { KpiVentasSnapshot } from '../../performance/entities/kpi-ventas-snapshot.entity';
import { EvaluacionDesempeno } from '../../performance/entities/evaluacion-desempeno.entity';
import { ResultadoKpi } from '../../performance/entities/resultado-kpi.entity';
import { DetalleResultadoKpi } from '../../performance/entities/detalle-resultado-kpi.entity';
import { calcularVentas } from '../../performance/services/ventas-calculo';
import { codigoSap, CRITERIOS_VENTAS, dec, periodoVentas, texto, VENTAS } from '../../performance/services/ventas-reglas';
import { ClientesVentasDto, MetaVentasDto } from './ventas.dto';

@Injectable()
export class VentasService {
  constructor(private readonly db: DataSource, private readonly sap: SapService, private readonly config: ConfigService) {}

  periodo(anio: number, mes: number) {
    return periodoVentas(anio, mes, this.config.get<string>('KPI_TIME_ZONE') || 'America/Guatemala');
  }

  async contexto(idUsuario: number, manager = this.db.manager) {
    if (!Number.isSafeInteger(idUsuario) || idUsuario < 1) throw new ForbiddenException();
    const actor = await manager.getRepository(Usuario).findOne({ where: { idUsuario, isActive: true, estado: EstadoUsuario.ACTIVO }, relations: { rol: true } });
    if (!actor?.rol?.isActive || ![1, 2, 3, 4].includes(actor.rol.nivelJerarquico!)) throw new ForbiddenException();
    const metricas = await manager.getRepository(MetricaKpi).find({ where: { codigoKpi: In(Object.keys(VENTAS)), isActive: true } });
    const idDepartamento = 2; // Ventas: alcance confirmado explicitamente.
    if (metricas.length !== 5 || metricas.some(m => m.idDepartamento !== idDepartamento) || metricas.some(m => dec(m.pesoPorcentaje) !== dec(VENTAS[m.codigoKpi])))
      throw new ConflictException('CONFIGURACION_VENTAS_INCOMPLETA: configure las cinco metricas y sus pesos');
    if (!await manager.getRepository(Departamento).existsBy({ idDepartamento, isActive: true })) throw new ConflictException('Departamento de Ventas inactivo');
    const empleados = await manager.getRepository(Empleado).find({
      where: { isActive: true, puesto: { idDepartamento } },
      select: { idEmpleado: true, idJefeDirecto: true, codigoSapEmpleado: true, primerNombre: true, primerApellido: true },
      order: { idEmpleado: 'ASC' },
    });
    if (actor.rol.nivelJerarquico! <= 2 && (!actor.idEmpleado || !await manager.getRepository(Empleado).existsBy({ idEmpleado: actor.idEmpleado, isActive: true })))
      throw new ForbiddenException('El usuario necesita un empleado activo asociado');
    return { actor, metricas, empleados, idDepartamento };
  }

  autorizar(c: Awaited<ReturnType<VentasService['contexto']>>, id: number, escribir = false) {
    const e = c.empleados.find(e => e.idEmpleado === id);
    const nivel = c.actor.rol.nivelJerarquico!;
    if (!e || (escribir && nivel < 2) || (nivel === 1 && id !== c.actor.idEmpleado) ||
      (nivel === 2 && e.idJefeDirecto !== c.actor.idEmpleado && (escribir || id !== c.actor.idEmpleado)))
      throw new ForbiddenException('Empleado fuera del alcance autorizado de Ventas');
    return e;
  }

  async dashboard(idUsuario: number, anio: number, mes: number, equipo = false, objetivo?: number, manager = this.db.manager) {
    const periodo = this.periodo(anio, mes), c = await this.contexto(idUsuario, manager);
    if (equipo && c.actor.rol.nivelJerarquico! < 2) throw new ForbiddenException();
    const seleccion = objetivo ? [this.autorizar(c, objetivo)] : equipo ? c.empleados.filter(e =>
      c.actor.rol.nivelJerarquico! >= 3 || e.idJefeDirecto === c.actor.idEmpleado) : [this.autorizar(c, c.actor.idEmpleado ?? 0)];
    if (!seleccion.length) return { periodo, criterios: CRITERIOS_VENTAS, empleados: [] };
    const ids = seleccion.map(e => e.idEmpleado);
    const evaluaciones = await manager.getRepository(EvaluacionDesempeno).find({ where: { idEmpleado: In(ids), idDepartamento: c.idDepartamento, periodoAnio: anio, periodoMes: mes, isActive: true } });
    const cerradas = evaluaciones.filter(e => !['BORRADOR', 'CALCULADA'].includes(e.estado));
    const snapshots = cerradas.length ? await manager.getRepository(KpiVentasSnapshot).find({ where: { idEvaluacionDesempeno: In(cerradas.map(e => e.idEvaluacionDesempeno)) } }) : [];
    const abiertos = seleccion.filter(e => !cerradas.some(ev => ev.idEmpleado === e.idEmpleado));
    // Una consulta para todo el equipo. No se devuelven filas SAP fuera del alcance.
    const filas = abiertos.length ? await this.sap.obtenerKpiVentas(periodo.fechaInicio, periodo.fechaFin) : [];
    const [metas, diarias, rangos] = await Promise.all([
      manager.getRepository(MetaKpiEmpleado).find({ where: { idEmpleado: In(ids), idMetrica: c.metricas.find(m => m.codigoKpi === 'VEN_META_MENSUAL')!.idMetrica, periodoAnio: anio, periodoMes: Between(1, mes) } }),
      manager.getRepository(MetricaKpiDiaria).find({ where: { idEmpleado: In(ids), idMetrica: c.metricas.find(m => m.codigoKpi === 'VEN_NUEVOS_CLIENTES')!.idMetrica, fecha: Between(periodo.fechaInicio, periodo.fechaFin) } }),
      manager.getRepository(RangoKpi).find({ where: { idMetrica: In(c.metricas.map(m => m.idMetrica)), isActive: true }, order: { orden: 'ASC' } }),
    ]);
    const empleados = seleccion.map(e => {
      const base = { idEmpleado: e.idEmpleado, nombre: `${e.primerNombre} ${e.primerApellido}` };
      const cerrada = cerradas.find(ev => ev.idEmpleado === e.idEmpleado);
      if (cerrada) {
        const snapshot = snapshots.find(s => s.idEvaluacionDesempeno === cerrada.idEvaluacionDesempeno);
        return snapshot ? { ...snapshot.datos, cerrado: true } : { ...base, estado: 'CERRADA_SIN_SNAPSHOT', notaFinal: null, resultados: [] };
      }
      const codigo = codigoSap(e.codigoSapEmpleado);
      const fallo = (estado: string) => ({ ...base, estado, notaFinal: null, resultados: [] });
      if (codigo === null) return fallo('CODIGO_SAP_INVALIDO');
      if (c.empleados.filter(x => codigoSap(x.codigoSapEmpleado) === codigo).length > 1) return fallo('CONFLICTO_CODIGO_SAP');
      const coincidencias = filas.filter(f => codigoSap(f.slpCode) === codigo);
      if (!coincidencias.length) return fallo('SIN_CORRESPONDENCIA');
      if (coincidencias.length !== 1) return fallo('CONFLICTO_CODIGO_SAP');
      const propias = diarias.filter(d => d.idEmpleado === e.idEmpleado);
      if (new Set(propias.map(d => d.fecha)).size !== propias.length) return fallo('CONFLICTO_REGISTROS_DIARIOS');
      try {
        return { ...base, ...calcularVentas(coincidencias[0], mes, metas.filter(m => m.idEmpleado === e.idEmpleado), propias.reduce((a, d) => a + dec(d.valor), 0n), c.metricas, rangos),
          sap: coincidencias[0], provisional: periodo.provisional, periodo, criterios: CRITERIOS_VENTAS };
      } catch {
        throw new ServiceUnavailableException({ estado: 'SAP_CONTRATO_INVALIDO', message: 'Datos decimales o contrato de SAP invalidos' });
      }
    });
    return { periodo, criterios: CRITERIOS_VENTAS, empleados };
  }

  async bloquear(manager: EntityManager, idEmpleado: number, anio: number, mes: number, acumulada = false) {
    await manager.getRepository(Empleado).findOne({ where: { idEmpleado }, lock: { mode: 'pessimistic_write' } });
    const evaluaciones = await manager.getRepository(EvaluacionDesempeno).find({ where: { idEmpleado, periodoAnio: anio, periodoMes: acumulada ? Between(mes, 12) : mes, isActive: true } });
    if (evaluaciones.some(e => !['BORRADOR', 'CALCULADA'].includes(e.estado))) throw new ConflictException('PERIODO_CERRADO');
  }

  async empleadosDisponibles(idUsuario: number) {
    const c = await this.contexto(idUsuario);
    const nivel = c.actor.rol.nivelJerarquico!;
    return c.empleados.filter(e => nivel >= 3 || (nivel === 1 ? e.idEmpleado === c.actor.idEmpleado : e.idJefeDirecto === c.actor.idEmpleado))
      .map(e => ({ idEmpleado: e.idEmpleado, nombre: [e.primerNombre, e.primerApellido].filter(Boolean).join(' ') }));
  }

  async clientesDia(idUsuario: number, idEmpleado: number, fecha: string) {
    const c = await this.contexto(idUsuario); this.autorizar(c, idEmpleado);
    const f = new Date(fecha + 'T00:00:00Z');
    if (!Number.isFinite(f.getTime()) || f.toISOString().slice(0,10) !== fecha) throw new BadRequestException('Fecha invalida');
    const p = this.periodo(Number(fecha.slice(0,4)), Number(fecha.slice(5,7)));
    if (fecha > p.fechaFin) throw new BadRequestException('Fecha futura');
    const rows = await this.db.getRepository(MetricaKpiDiaria).find({ where: {
      idEmpleado, fecha, idMetrica: c.metricas.find(m => m.codigoKpi === 'VEN_NUEVOS_CLIENTES')!.idMetrica,
    } });
    if (rows.length > 1) throw new ConflictException('CONFLICTO_REGISTROS_DIARIOS');
    return { idEmpleado, fecha, cantidad: rows.length ? Number(rows[0].valor) : null };
  }

  async metas(idUsuario: number, anio: number, mes: number, idEmpleado?: number) {
    const c = await this.contexto(idUsuario);
    const id = idEmpleado ?? c.actor.idEmpleado ?? 0;
    this.autorizar(c, id);
    return this.db.getRepository(MetaKpiEmpleado).find({ where: { idEmpleado: id, idMetrica: c.metricas.find(m => m.codigoKpi === 'VEN_META_MENSUAL')!.idMetrica, periodoAnio: anio, periodoMes: Between(1, mes) }, order: { periodoMes: 'ASC' } });
  }

  async guardarMeta(idUsuario: number, dto: MetaVentasDto) {
    // Se permite planificar metas futuras, no evaluar periodos futuros.
    if (dec(dto.metaObjetivo) <= 0n) throw new BadRequestException('La meta debe ser positiva');
    return this.db.transaction(async manager => {
      const c = await this.contexto(idUsuario, manager);
      if (c.actor.rol.nivelJerarquico! < 3) throw new ForbiddenException('Solo RRHH/administrador configuran metas');
      this.autorizar(c, dto.idEmpleado, true);
      await this.bloquear(manager, dto.idEmpleado, dto.anio, dto.mes, true);
      const repo = manager.getRepository(MetaKpiEmpleado);
      const where = { idEmpleado: dto.idEmpleado, idMetrica: c.metricas.find(m => m.codigoKpi === 'VEN_META_MENSUAL')!.idMetrica, periodoAnio: dto.anio, periodoMes: dto.mes };
      const anterior = await repo.findOne({ where });
      const nuevo = await repo.save(repo.create({ ...anterior, ...where, metaObjetivo: texto(dec(dto.metaObjetivo), 2) }));
      await manager.getRepository(KpiCambio).save({ idUsuario, idEmpleado: dto.idEmpleado, operacion: 'META_VENTAS', anterior, nuevo });
      return nuevo;
    });
  }

  async clientes(idUsuario: number, dto: ClientesVentasDto) {
    const fecha = new Date(`${dto.fecha}T00:00:00Z`);
    if (!Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== dto.fecha) throw new BadRequestException('Fecha invalida');
    const anio = Number(dto.fecha.slice(0, 4)), mes = Number(dto.fecha.slice(5, 7));
    if (dto.fecha > this.periodo(anio, mes).fechaFin) throw new BadRequestException('Fecha futura');
    return this.db.transaction(async manager => {
      const c = await this.contexto(idUsuario, manager); this.autorizar(c, dto.idEmpleado, true);
      await this.bloquear(manager, dto.idEmpleado, anio, mes);
      const repo = manager.getRepository(MetricaKpiDiaria);
      const where = { idEmpleado: dto.idEmpleado, idMetrica: c.metricas.find(m => m.codigoKpi === 'VEN_NUEVOS_CLIENTES')!.idMetrica, fecha: dto.fecha };
      const existentes = await repo.find({ where });
      if (existentes.length > 1) throw new ConflictException('CONFLICTO_REGISTROS_DIARIOS');
      const anterior = existentes[0] ?? null;
      const nuevo = await repo.save(repo.create({ ...anterior, ...where, valor: String(dto.cantidad), fuente: 'MANUAL', desgloseOrigen: null }));
      await manager.getRepository(KpiCambio).save({ idUsuario, idEmpleado: dto.idEmpleado, operacion: 'CLIENTES_VENTAS', anterior, nuevo });
      return nuevo;
    });
  }

  async guardar(idUsuario: number, idEmpleado: number, anio: number, mes: number) {
    return this.db.transaction(async manager => {
      const c = await this.contexto(idUsuario, manager); this.autorizar(c, idEmpleado, true);
      await this.bloquear(manager, idEmpleado, anio, mes);
      const dashboard = await this.dashboard(idUsuario, anio, mes, false, idEmpleado, manager);
      const datos = dashboard.empleados[0];
      if (!datos || datos.notaFinal === null) return { guardado: false, ...dashboard };
      const repo = manager.getRepository(EvaluacionDesempeno);
      const where = { idEmpleado, idDepartamento: c.idDepartamento, periodoAnio: anio, periodoMes: mes, isActive: true };
      const anterior = await repo.findOne({ where });
      const evaluacion = await repo.save(repo.create({ ...anterior, ...where, puntajeBase: datos.notaFinal, notaFinal: datos.notaFinal, penalizacionTotal: '0', metaGlobal: '100', estado: 'CALCULADA' }));
      for (const r of datos.resultados) {
        const resultados = manager.getRepository(ResultadoKpi);
        const existente = await resultados.findOne({ where: { idEvaluacionDesempeno: evaluacion.idEvaluacionDesempeno, idMetrica: r.idMetrica } });
        const resultado = await resultados.save(resultados.create({ ...existente, idEvaluacionDesempeno: evaluacion.idEvaluacionDesempeno, idMetrica: r.idMetrica,
          valorObtenido: r.valorObtenido!, metaAplicada: r.metaAplicada, porcentajeCumplimiento: r.porcentajeCumplimiento,
          puntosObtenidos: texto(dec(r.puntos!), 2), cantidadEventos: 0, penalizacionGenerada: '0', isActive: true,
          observacion: JSON.stringify({ version: 1, pesoPorcentaje: r.pesoPorcentaje, regla: r.reglaAplicada }) }));
        const detalle = manager.getRepository(DetalleResultadoKpi);
        await detalle.delete({ idResultado: resultado.idResultado });
        await detalle.save({ idResultado: resultado.idResultado, origen: r.codigo === 'VEN_NUEVOS_CLIENTES' ? 'MANUAL' : 'SAP', valor: texto(dec(r.valorObtenido!), 2), descripcion: 'KPI Ventas; contrato y criterios completos en snapshot' });
      }
      await manager.getRepository(KpiVentasSnapshot).save({ idEvaluacionDesempeno: evaluacion.idEvaluacionDesempeno, datos });
      await manager.getRepository(KpiCambio).save({ idUsuario, idEmpleado, operacion: 'EVALUACION_VENTAS', anterior, nuevo: evaluacion });
      return { guardado: true, idEvaluacion: evaluacion.idEvaluacionDesempeno, ...dashboard };
    });
  }
}
