import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsoEvento } from './uso-evento.entity';
import { Usuario } from '../user/entities/user.entity';
import { EstadoUsuario } from '../user/estado-usuario.enum';
import { ConsultaUsoDto } from './uso.dto';
import { fechaUtcTexto } from './uso-reglas';
export type EventoUso = Pick<UsoEvento,'idUsuario'|'nivelRol'|'modulo'|'accion'|'origen'|'metodo'|'ruta'|'estadoHttp'|'exito'|'duracionMs'|'eventoCliente'>;
export function rangoUso(q: ConsultaUsoDto) {
  const parse = (s: string) => {
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(s) && !/^2100-\d{2}-\d{2}$/.test(s)) throw new BadRequestException('Fecha invalida');
    const n=Date.parse(s+'T00:00:00Z');
    if (!Number.isFinite(n) || new Date(n).toISOString().slice(0,10)!==s) throw new BadRequestException('Fecha invalida');
    return n;
  };
  const a=parse(q.desde), b=parse(q.hasta);
  const dias=(b-a)/86400000+1;
  if (dias<1 || dias>366) throw new BadRequestException('El rango debe abarcar entre 1 y 366 dias');
  return {desdeUtc:fechaUtcTexto(new Date(a+6*3600000)),hastaUtc:fechaUtcTexto(new Date(b+30*3600000)),dias};
}
@Injectable()
export class UsoService {
  private readonly logger=new Logger(UsoService.name);
  private pendientes=0;
  private ultimoAviso=0;
  constructor(@InjectRepository(UsoEvento) private readonly eventos:Repository<UsoEvento>,
    @InjectRepository(Usuario) private readonly usuarios:Repository<Usuario>, private readonly config:ConfigService) {}
  habilitado() { return this.config.get<string>('USO_HABILITADO') !== 'false'; }
  private avisar() {
    if (Date.now()-this.ultimoAviso>30000) { this.ultimoAviso=Date.now(); this.logger.warn('Registro de uso no disponible o saturado; algunos eventos no se guardaron. Verifique tabla uso_eventos y conectividad.'); }
  }
  async registrar(evento: EventoUso):Promise<boolean> {
    if (!this.habilitado()) return false;
    if (!Number.isSafeInteger(evento.idUsuario) || evento.idUsuario<1) return false;
    if (this.pendientes>=100) {this.avisar();return false;}
    this.pendientes++;
    try {
      await this.eventos.insert({...evento, fechaUtc:fechaUtcTexto()});
      return true;
    } catch(e) {
      // Reintentos del mismo evento de navegacion no duplican visitas.
      if (evento.eventoCliente && (e as {code?:string}).code==='ER_DUP_ENTRY') return true;
      this.avisar(); return false;
    } finally {this.pendientes--;}
  }
  async administrador(idUsuario:number) {
    if (!Number.isSafeInteger(idUsuario) || idUsuario<1) throw new ForbiddenException();
    const usuario=await this.usuarios.findOne({where:{idUsuario,isActive:true,estado:EstadoUsuario.ACTIVO},relations:{rol:true}});
    if (!usuario?.rol?.isActive || usuario.rol.nivelJerarquico!==4) throw new ForbiddenException('Solo administracion consulta indicadores internos de uso');
  }
  private filtro(q:ConsultaUsoDto) {
    const rango=rangoUso(q);
    let where='fecha_utc >= ? AND fecha_utc < ?';
    const params:unknown[]=[rango.desdeUtc,rango.hastaUtc];
    if (q.modulo) {where+=' AND modulo = ?';params.push(q.modulo);}
    if (q.idUsuario) {where+=' AND id_usuario = ?';params.push(q.idUsuario);}
    return {where,params,rango};
  }
  async resumen(idUsuario:number,q:ConsultaUsoDto) {
    await this.administrador(idUsuario);
    const {where,params,rango}=this.filtro(q);
    const [totales,porAccion,porDia]=await Promise.all([
      this.eventos.query(`SELECT COUNT(*) eventos, COALESCE(SUM(exito=1),0) exitosos, COALESCE(SUM(exito=0),0) fallidos,
        COUNT(DISTINCT CASE WHEN exito=1 THEN id_usuario END) usuarios_activos,
        COALESCE(SUM(origen='NAVEGACION' AND exito=1),0) entradas_modulos,
        COALESCE(SUM(origen='API'),0) solicitudes_api
        FROM uso_eventos WHERE ${where}`,params),
      this.eventos.query(`SELECT modulo,accion,origen,COUNT(*) eventos,COALESCE(SUM(exito=1),0) exitosos,
        COALESCE(SUM(exito=0),0) fallidos,COUNT(DISTINCT CASE WHEN exito=1 THEN id_usuario END) usuarios_activos,
        ROUND(AVG(duracion_ms),2) duracion_media_ms
        FROM uso_eventos WHERE ${where} GROUP BY modulo,accion,origen ORDER BY eventos DESC,modulo,accion`,params),
      this.eventos.query(`SELECT DATE_FORMAT(DATE_SUB(fecha_utc,INTERVAL 6 HOUR),'%Y-%m-%d') dia,origen,COUNT(*) eventos,
        COUNT(DISTINCT CASE WHEN exito=1 THEN id_usuario END) usuarios_activos,
        COALESCE(SUM(exito=1),0) exitosos FROM uso_eventos WHERE ${where}
        GROUP BY dia,origen ORDER BY dia,origen`,params),
    ]);
    return {periodo:{desde:q.desde,hasta:q.hasta,dias:rango.dias,zona:'America/Guatemala'},totales:totales[0],porAccion,porDia,
      criterios:['Los eventos API son solicitudes, no visitas a pantallas ni filas insertadas.',
        'Entradas a modulos requieren POST /uso/entradas desde el frontend; no se infieren de las consultas.',
        'Usuarios activos = usuarios distintos con al menos un evento exitoso en el grupo.',
        'No mide permanencia ni productividad. Puede perder eventos si la base falla o el proceso se interrumpe.']};
  }
  async recurrencia(idUsuario:number,q:ConsultaUsoDto) {
    await this.administrador(idUsuario);
    const {where,params,rango}=this.filtro(q);
    const rows=await this.eventos.query(`SELECT id_usuario, COUNT(*) eventos,
      COALESCE(SUM(exito=1),0) exitosos,
      COUNT(DISTINCT CASE WHEN exito=1 THEN DATE(DATE_SUB(fecha_utc,INTERVAL 6 HOUR)) END) dias_activos,
      COUNT(DISTINCT CASE WHEN exito=1 THEN modulo END) modulos_utilizados,
      COALESCE(SUM(origen='NAVEGACION' AND exito=1),0) entradas_modulos,
      DATE_FORMAT(MIN(fecha_utc),'%Y-%m-%dT%H:%i:%s.%fZ') primer_evento_utc,DATE_FORMAT(MAX(fecha_utc),'%Y-%m-%dT%H:%i:%s.%fZ') ultimo_evento_utc
      FROM uso_eventos WHERE ${where} GROUP BY id_usuario ORDER BY dias_activos DESC,eventos DESC,id_usuario LIMIT 201`,params);
    return {zona:'America/Guatemala',diasPeriodo:rango.dias,hayMas:rows.length>200,limite:200,usuarios:rows.slice(0,200),
      criterio:'Dias activos distintos por usuario. Para mas detalle filtre idUsuario o reduzca el rango.'};
  }
}
