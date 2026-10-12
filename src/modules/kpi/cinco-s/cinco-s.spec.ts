import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { calcularInspeccion, resumenCincoS } from './cinco-s.reglas';
import { aplicarCincoS } from './cinco-s.integracion';
import { InspeccionCincoS } from './inspeccion-cinco-s.entity';
import { EvaluacionDesempeno } from '../../performance/entities/evaluacion-desempeno.entity';
import { ResultadoKpi } from '../../performance/entities/resultado-kpi.entity';
import { MetricaKpi } from '../../performance/entities/metrica-kpi.entity';
import { Departamento } from '../../organization/departamentos/entities/departamento.entity';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { CincoSService } from './cinco-s.service';
import { GuardarCincoSDto } from './cinco-s.dto';
import { validate } from 'class-validator';
import { EvaluacionKpiService } from '../../performance/services/evaluacion-kpi.service';

describe('Reglas 5S', () => {
  it.each([0, 5])('admite extremos %s sin confundir cero y vacío', punto => {
    expect(calcularInspeccion(Array(20).fill(punto))).toEqual({ categorias: Array(5).fill(punto * 4), total: punto * 20 });
  });
  it.each([[], Array(19).fill(5), Array(21).fill(5), [...Array(19).fill(5), null], [...Array(19).fill(5), 2.5], Array(20).fill(6), Array(20).fill(-1)].map(p => [p]))('rechaza inspecciones inválidas %#', puntos => {
    expect(() => calcularInspeccion(puntos as number[])).toThrow(BadRequestException);
  });
  it('calcula 91 y 94 como 92.5 y 18.5, sin rangos ni redondeos', () => {
    const a = [...Array(18).fill(5), 1, 0];
    const b = [...Array(18).fill(5), 4, 0];
    expect(resumenCincoS([{ puntos: a }, { puntos: b }])).toMatchObject({ completo: true, promedio: 92.5, puntosKpi: 18.5 });
  });
  it.each([0, 1])('mantiene pendiente el mes con %s inspecciones', n => {
    expect(resumenCincoS(Array(n).fill({ puntos: Array(20).fill(5) }))).toMatchObject({ completo: false, promedio: null, puntosKpi: null });
  });
  it('dos inspecciones en cero producen un aporte real de cero', () => {
    expect(resumenCincoS(Array(2).fill({ puntos: Array(20).fill(0) }))).toMatchObject({ completo: true, promedio: 0, puntosKpi: 0 });
  });
  it('valida el número de inspección y el tamaño de la lista en el DTO', async () => {
    const dto = Object.assign(new GuardarCincoSDto(), { idDepartamento: 1, numero: 3, fecha: '2026-10-09', sucursal: 'Zona 7', encargado: 'Encargado', puntos: [5] });
    const errors = await validate(dto);
    expect(errors.map(e => e.property)).toEqual(expect.arrayContaining(['numero', 'puntos']));
  });
});

describe('Integración 5S con la nota mensual', () => {
  it('actualiza la nota existente sin duplicar el aporte y conserva penalizaciones', async () => {
    let guardado: ResultadoKpi | null = null;
    const inspecciones = { find: jest.fn().mockResolvedValue([
      { idInspeccion: 1, puntos: [...Array(18).fill(5), 1, 0] },
      { idInspeccion: 2, puntos: [...Array(18).fill(5), 4, 0] },
    ]) };
    const resultados = { findOne: jest.fn(async () => guardado), create: (x: ResultadoKpi) => x, save: jest.fn(async x => { guardado = x; return x; }) };
    const evaluaciones = { save: jest.fn(async x => x) };
    const manager = { getRepository: (entity: unknown) => entity === InspeccionCincoS ? inspecciones : entity === ResultadoKpi ? resultados : evaluaciones } as unknown as EntityManager;
    const e = { idEvaluacionDesempeno: 1, idDepartamento: 3, periodoAnio: 2026, periodoMes: 10, puntajeBase: '80', penalizacionTotal: '2' } as EvaluacionDesempeno;
    const m = { idMetrica: 20 } as MetricaKpi;
    await aplicarCincoS(manager, e, m);
    expect(e).toMatchObject({ puntajeBase: '98.50', notaFinal: '96.50', estado: 'CALCULADA' });
    await aplicarCincoS(manager, e, m);
    expect(e.notaFinal).toBe('96.50');
    e.puntajeBase = '70';
    await aplicarCincoS(manager, e, m, false);
    expect(e.notaFinal).toBe('86.50');
    expect(resultados.save).toHaveBeenLastCalledWith(expect.objectContaining({ valorObtenido: '92.5', puntosObtenidos: '18.5' }));
  });
  it('marca una nota provisional sin fabricar un resultado 5S con una sola inspección', async () => {
    const saveResultado = jest.fn();
    const manager = { getRepository: (e: unknown) => e === InspeccionCincoS
      ? { find: async () => [{ puntos: Array(20).fill(5) }] }
      : e === ResultadoKpi ? { findOne: async () => null, save: saveResultado }
      : { save: async (x: unknown) => x } } as unknown as EntityManager;
    const e = { puntajeBase: '80', penalizacionTotal: '0' } as EvaluacionDesempeno;
    await aplicarCincoS(manager, e, { idMetrica: 20 } as MetricaKpi);
    expect(e.estado).toBe('PENDIENTE_5S'); expect(e.notaFinal).toBe('80.00'); expect(saveResultado).not.toHaveBeenCalled();
  });
});

describe('Permisos y registro por departamento', () => {
  const usuario = { idUsuario: 1, nivelJerarquico: 3, correo: 'inspector@example.test' };
  const dto = { idDepartamento: 3, numero: 1, fecha: '2026-10-09', sucursal: 'Zona 7', encargado: 'Encargado', puntos: Array(20).fill(5) };
  function crear(existentes: object[] = []) {
    const inspecciones = { find: jest.fn().mockResolvedValue(existentes), create: jest.fn(x => x), save: jest.fn(async x => x) };
    const departamentos = { find: jest.fn().mockResolvedValue([{ idDepartamento: 3 }]), findOne: jest.fn().mockResolvedValue({ idDepartamento: 3 }) };
    const empleados = { find: jest.fn().mockResolvedValue([{ puesto: { idDepartamento: 3 } }]) };
    const metricas = { findOne: jest.fn().mockResolvedValue({ idMetrica: 20 }) };
    const evaluaciones = { find: jest.fn().mockResolvedValue([]) };
    const repos = new Map<unknown, unknown>([[InspeccionCincoS, inspecciones], [Departamento, departamentos], [Empleado, empleados], [MetricaKpi, metricas], [EvaluacionDesempeno, evaluaciones]]);
    const manager = { getRepository: (e: unknown) => repos.get(e) };
    const data = { manager, transaction: async (_isolation: string, f: (m: unknown) => unknown) => f(manager) } as unknown as DataSource;
    return { service: new CincoSService(data), inspecciones, departamentos, empleados, evaluaciones };
  }
  it.each(['guardar', 'recalcular'])('%s genera las evaluaciones faltantes cuando hay dos inspecciones', async accion => {
    const primera = { numero: 1, puntos: Array(20).fill(5) };
    const segunda = { numero: 2, puntos: Array(20).fill(4) };
    const { service, inspecciones, empleados, departamentos } = crear([primera, segunda]);
    if (accion === 'guardar') inspecciones.find.mockResolvedValueOnce([primera]);
    empleados.find.mockResolvedValue([{ idEmpleado: 7 }, { idEmpleado: 8 }]);
    const calcular = jest.spyOn(EvaluacionKpiService.prototype, 'calcularEvaluacionMensual')
      .mockResolvedValueOnce({} as Awaited<ReturnType<EvaluacionKpiService['calcularEvaluacionMensual']>>)
      .mockRejectedValueOnce(new NotFoundException('Sin métricas'));
    try {
      const respuesta = accion === 'guardar'
        ? await service.guardar({ ...dto, numero: 2 }, usuario)
        : await service.recalcular(3, 2026, 10, usuario);
      expect(respuesta).toMatchObject({ evaluacionesActualizadas: 0, evaluacionesCreadas: 1, empleadosSinDatos: [8] });
      expect(calcular).toHaveBeenCalledWith(7, 3, 2026, 10);
      expect(departamentos.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
    } finally { calcular.mockRestore(); }
  });
  it('no genera una nota mensual con solo una inspección', async () => {
    const { service, empleados } = crear([{ numero: 1, puntos: Array(20).fill(5) }]);
    const respuesta = await service.recalcular(3, 2026, 10, usuario);
    expect(respuesta.evaluacionesCreadas).toBe(0);
    expect(empleados.find).not.toHaveBeenCalled();
    expect(respuesta.resumen.completo).toBe(false);
  });
  it('registra el inspector autenticado y bloquea el departamento durante la escritura', async () => {
    const { service, inspecciones, departamentos } = crear();
    await service.guardar(dto, usuario);
    expect(inspecciones.save).toHaveBeenCalledWith(expect.objectContaining({ total: 100, idUsuarioInspector: 1, anio: 2026, mes: 10 }));
    expect(departamentos.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
  });
  it.each([[{ numero: 1 }], [{ numero: 1 }, { numero: 2 }]].map(e => [e]))('rechaza duplicados y una tercera inspección %#', async existentes => {
    const { service, inspecciones } = crear(existentes);
    await expect(service.guardar(dto, usuario)).rejects.toBeInstanceOf(ConflictException);
    expect(inspecciones.save).not.toHaveBeenCalled();
  });
  it('rechaza una fecha inexistente', async () => {
    await expect(crear().service.guardar({ ...dto, fecha: '2026-02-30' }, usuario)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rechaza a un usuario sin permisos', async () => {
    await expect(crear().service.guardar(dto, { ...usuario, nivelJerarquico: 1 })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('limita a los supervisores a departamentos de sus subordinados', async () => {
    const { service, empleados, departamentos } = crear();
    await service.departamentos({ ...usuario, nivelJerarquico: 2, idEmpleado: 7 });
    expect(empleados.find).toHaveBeenCalledWith(expect.objectContaining({ where: { idJefeDirecto: 7, isActive: true } }));
    expect(departamentos.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ idDepartamento: expect.anything() }) }));
    await expect(service.guardar({ ...dto, idDepartamento: 99 }, usuario)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
