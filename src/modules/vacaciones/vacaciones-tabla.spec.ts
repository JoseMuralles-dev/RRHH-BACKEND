import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { VacacionesGestionService } from './vacaciones-gestion.service';
import { VacacionesSaldoService } from './vacaciones-saldo.service';
import { TablaSaldosDto } from './dto/saldo-vacaciones.dto';

describe('Alcance de tabla de saldos y selector', () => {
  const query = jest.fn();
  const actor = jest.fn();
  let service: VacacionesGestionService;
  beforeEach(() => {
    jest.resetAllMocks();
    query.mockImplementation(async (sql: string) => sql.includes('COUNT(*)') ? [{ total: '0' }] : []);
    actor.mockResolvedValue({ idEmpleado: 10, rol: { codigoRol: 'ENCARGADO', nivelJerarquico: 2 } });
    const db = { transaction: (...args: unknown[]) => (args[args.length - 1] as (m: unknown) => unknown)({ query }) };
    service = new VacacionesGestionService(db as unknown as DataSource, { actor } as unknown as VacacionesSaldoService);
  });
  it('limita el selector al jefe de la sesión y empleados activos', async () => {
    await service.empleadosDisponibles(5);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('e.id_jefe_directo = ? AND e.is_active = 1'), [10]);
  });
  it('mantiene el alcance incluso al pedir otro empleado y paginar', async () => {
    const dto = Object.assign(new TablaSaldosDto(), { idEmpleado: 99, buscar: 'Ana', pagina: 2 });
    await service.tablaSaldos(5, dto);
    expect(query.mock.calls[0][0]).toContain('vw_vacaciones_saldos');
    for (const [sql] of query.mock.calls) expect(sql).toContain('e.id_jefe_directo = ? AND e.is_active = 1 AND e.id_empleado = ?');
    expect(query.mock.calls[1][1]).toEqual([10, 99, 'Ana', 20, 20]);
  });
  it.each([['RRHH', 3], ['ADMIN', 4]])('permite consulta general para %s', async (codigoRol, nivelJerarquico) => {
    actor.mockResolvedValue({ idEmpleado: null, rol: { codigoRol, nivelJerarquico } });
    await service.tablaSaldos(5, new TablaSaldosDto());
    expect(query.mock.calls[1][0]).not.toContain('id_jefe_directo =');
    expect(query.mock.calls[1][1]).toEqual([20, 0]);
  });
  it.each([{ idEmpleado: null, rol: { nivelJerarquico: 2 } }, { idEmpleado: 10, rol: { nivelJerarquico: 1 } }])('rechaza sesiones sin alcance de equipo', async usuario => {
    actor.mockResolvedValue(usuario);
    await expect(service.tablaSaldos(5, new TablaSaldosDto())).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.empleadosDisponibles(5)).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });
  it('parametriza el texto de búsqueda y ordena con una lista permitida', async () => {
    const buscar = "' OR 1=1 --";
    await service.tablaSaldos(5, Object.assign(new TablaSaldosDto(), { buscar, orden: 'saldo', direccion: 'DESC' }));
    expect(query.mock.calls[1][0]).not.toContain(buscar);
    expect(query.mock.calls[1][0]).toContain('ORDER BY v.saldo_dias DESC');
    expect(query.mock.calls[1][1]).toContain(buscar);
    const invalido = plainToInstance(TablaSaldosDto, { orden: 'password', direccion: 'DROP', idEmpleado: -1, limite: 1000 });
    expect((await validate(invalido)).length).toBe(4);
  });
});
