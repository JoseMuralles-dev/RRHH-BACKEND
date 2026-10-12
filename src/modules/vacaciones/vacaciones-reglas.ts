import { BadRequestException, ConflictException } from '@nestjs/common';
import { validarPeriodo } from '../solicitudes/solicitud-reglas';

// DECIMAL se calcula en centésimas enteras; nunca sumar fracciones binarias.
export function centesimas(value: string | number): number {
  const text = String(value);
  if (!/^-?\d+(\.\d{1,2})?$/.test(text))
    throw new BadRequestException('Días inválidos: máximo dos decimales');
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  const result =
    (Number(whole) * 100 + Number(fraction.padEnd(2, '0'))) *
    (text.startsWith('-') ? -1 : 1);
  if (!Number.isSafeInteger(result))
    throw new BadRequestException('Cantidad de días fuera de rango');
  return result;
}
export function decimal(value: number): string {
  if (!Number.isSafeInteger(value))
    throw new BadRequestException('Cantidad de días fuera de rango');
  return `${value < 0 ? '-' : ''}${Math.floor(Math.abs(value) / 100)}.${String(Math.abs(value) % 100).padStart(2, '0')}`;
}
export function fechaCalendario(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1000-01-01')
    throw new BadRequestException('Fecha inválida; use YYYY-MM-DD');
  const time = Date.parse(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('La fecha indicada no existe');
  return time;
}
export function rangoFechas(inicio: string, fin: string): void {
  if (fechaCalendario(fin) < fechaCalendario(inicio))
    throw new BadRequestException('La fecha final es anterior a la inicial');
}
export interface SaldoPeriodo {
  idPeriodo: number;
  fechaInicio: string;
  fechaFin: string;
  fechaCorteInicial: string | null;
  saldo: number;
}
export interface ReservaVacaciones {
  idSolicitud: number;
  fechaInicio: string | null;
  fechaFin: string | null;
  diasSolicitados: number | null;
}
export function validarReserva(s: ReservaVacaciones): void {
  if (!s.fechaInicio || !s.fechaFin || s.diasSolicitados == null)
    throw new ConflictException(
      'RRHH debe conciliar una solicitud de vacaciones sin fechas o días',
    );
  validarPeriodo(s.fechaInicio, s.fechaFin, s.diasSolicitados);
}
export function asignarReservas(
  periodos: SaldoPeriodo[],
  solicitudes: ReservaVacaciones[],
): Map<number, { idPeriodo: number; dias: number }[]> {
  const disponibles = [...periodos]
    .sort(
      (a, b) =>
        a.fechaInicio.localeCompare(b.fechaInicio) || a.idPeriodo - b.idPeriodo,
    )
    .map((p) => ({ ...p }));
  if (disponibles.some((p) => p.saldo < 0))
    throw new ConflictException(
      'RRHH debe conciliar períodos con saldo negativo',
    );
  const planes = new Map<number, { idPeriodo: number; dias: number }[]>();
  const ordenadas = [...solicitudes].sort(
    (a, b) =>
      (a.fechaInicio ?? '').localeCompare(b.fechaInicio ?? '') ||
      a.idSolicitud - b.idSolicitud,
  );
  for (let i = 0; i < ordenadas.length; i++) {
    const s = ordenadas[i];
    validarReserva(s);
    if (
      ordenadas
        .slice(0, i)
        .some(
          (o) => o.fechaFin! >= s.fechaInicio! && o.fechaInicio! <= s.fechaFin!,
        )
    )
      throw new ConflictException(
        'Hay vacaciones activas con fechas superpuestas',
      );
    if (
      disponibles.some(
        (p) =>
          p.fechaInicio <= s.fechaInicio! &&
          p.fechaCorteInicial &&
          s.fechaInicio! <= p.fechaCorteInicial,
      )
    ) {
      throw new ConflictException(
        'RRHH debe conciliar la solicitud anterior o cruzada con el corte inicial',
      );
    }
    let falta = centesimas(s.diasSolicitados!);
    const plan: { idPeriodo: number; dias: number }[] = [];
    for (const p of disponibles) {
      if (p.fechaInicio > s.fechaInicio!) continue;
      // No saltar un corte hacia otro período: podría duplicar consumo histórico.
      if (p.fechaCorteInicial && s.fechaInicio! <= p.fechaCorteInicial)
        throw new ConflictException(
          'RRHH debe conciliar la solicitud anterior o cruzada con el corte inicial',
        );
      const dias = Math.min(p.saldo, falta);
      if (dias > 0) {
        plan.push({ idPeriodo: p.idPeriodo, dias });
        p.saldo -= dias;
        falta -= dias;
      }
      if (!falta) break;
    }
    if (falta)
      throw new ConflictException(
        'Saldo de vacaciones insuficiente para cubrir la solicitud y las otras reservas',
      );
    planes.set(s.idSolicitud, plan);
  }
  return planes;
}
