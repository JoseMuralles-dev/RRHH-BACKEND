import { BadRequestException } from '@nestjs/common';
import { AprobacionIncidencia } from './entities/aprobacion-incidencia.entity';
import { EstadoAprobacion } from './enums/estado-aprobacion.enum';
import { EstadoSolicitud } from './enums/estado-solicitud.enum';

export const ESTADOS_ABIERTOS = [EstadoSolicitud.PENDIENTE, EstadoSolicitud.EN_REVISION];
export const ESTADOS_APROBADA = [EstadoSolicitud.APROBADA]

export function validarPeriodo(inicio: string, fin: string, dias: number): number {
  const convertir = (valor: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new BadRequestException('Las fechas deben tener formato YYYY-MM-DD');
    const fecha = new Date(`${valor}T00:00:00.000Z`);
    if (!Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) {
      throw new BadRequestException('La fecha indicada no existe');
    }
    return fecha.getTime();
  };
  const desde = convertir(inicio);
  const diferencia = convertir(fin) - desde;
  if (diferencia < 0) throw new BadRequestException('La fecha final no puede ser anterior a la fecha inicial');
  // Monday-Friday, inclusive. No holiday catalog is configured yet.
  const calendario = diferencia / 86400000 + 1;
  let laborables = Math.floor(calendario / 7) * 5;
  const primerDia = new Date(desde).getUTCDay();
  for (let i = 0; i < calendario % 7; i++) {
    const dia = (primerDia + i) % 7;
    if (dia !== 0 && dia !== 6) laborables++;
  }
  if (!laborables) throw new BadRequestException('El período no contiene días laborables de lunes a viernes');
  if (!Number.isSafeInteger(dias) || dias !== laborables) {
    throw new BadRequestException(`El período corresponde a ${laborables} días laborables; diasSolicitados debe coincidir`);
  }
  return laborables;
}

export function aprobacionDisponible(aprobaciones: AprobacionIncidencia[]): AprobacionIncidencia | undefined {
  const ordenadas = [...aprobaciones].sort((a, b) => a.nivelAprobacion - b.nivelAprobacion);
  if (ordenadas.length < 1 || ordenadas.length > 2 || ordenadas.some((a, index) => a.nivelAprobacion !== index + 1)) return undefined;
  const siguiente = ordenadas.find(a => a.estado !== EstadoAprobacion.APROBADA);
  return siguiente?.estado === EstadoAprobacion.PENDIENTE ? siguiente : undefined;
}
