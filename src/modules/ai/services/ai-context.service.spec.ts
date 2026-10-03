import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { MetricaKpi } from '../../performance/entities/metrica-kpi.entity';
import type { UsuarioAnalitico } from '../interfaces/ai-context.interface';
import { AiContextService } from './ai-context.service';

describe('AiContextService: alcance y periodos', () => {
  const empleados = { findOne: jest.fn(), find: jest.fn() };
  const metricas = { find: jest.fn() };
  const context = new AiContextService(
    empleados as unknown as Repository<Empleado>,
    metricas as unknown as Repository<MetricaKpi>,
  );
  const usuario = (
    nivel: number,
    idEmpleado: number | null = 10,
  ): UsuarioAnalitico => ({ idUsuario: 1, nivelJerarquico: nivel, idEmpleado });
  beforeEach(() => jest.resetAllMocks());

  it('resuelve bisiestos y rangos que cruzan el cambio de año', () => {
    expect(context.obtenerPeriodo(2024, 2).fechaFinal).toBe('2024-02-29');
    expect(context.obtenerPeriodo(2025, 2).fechaFinal).toBe('2025-02-28');
    expect(
      context.obtenerPeriodos(2026, 1, 3).map((p) => p.fechaInicial),
    ).toEqual(['2025-11-01', '2025-12-01', '2026-01-01']);
    expect(context.obtenerPeriodos(2026, 9, 12)).toHaveLength(12);
  });

  it.each([0, 13, 1.5, NaN])('rechaza cantidad de meses %s', (meses) => {
    expect(() => context.obtenerPeriodos(2026, 9, meses)).toThrow(
      BadRequestException,
    );
  });

  it('rechaza un rango que cruza el año minimo', () => {
    expect(() => context.obtenerPeriodos(2000, 1, 2)).toThrow(
      BadRequestException,
    );
  });

  it.each([1, 2])(
    'impide IDs de actor nulos para nivel %s antes de consultar',
    async (nivel) => {
      await expect(
        context.autorizarEmpleado(usuario(nivel, null), 21),
      ).rejects.toThrow(ForbiddenException);
      expect(empleados.findOne).not.toHaveBeenCalled();
    },
  );

  it.each([0, 5, 2.5, NaN])('rechaza nivel no reconocido %s', async (nivel) => {
    await expect(context.autorizarEquipo(usuario(nivel), 10)).rejects.toThrow(
      ForbiddenException,
    );
    expect(empleados.find).not.toHaveBeenCalled();
  });

  it('empleado solo puede consultar su propio registro', async () => {
    empleados.findOne.mockResolvedValue({
      idEmpleado: 10,
      puesto: { idDepartamento: 3 },
    });
    await expect(context.autorizarEmpleado(usuario(1), 10)).resolves.toEqual({
      idEmpleado: 10,
      idDepartamento: 3,
    });
    await expect(context.autorizarEmpleado(usuario(1), 21)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(context.autorizarEquipo(usuario(1), 10)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('encargado no puede sustituir el ID del equipo', async () => {
    empleados.findOne.mockResolvedValue({ idEmpleado: 10 });
    await expect(context.autorizarEquipo(usuario(2), 99)).rejects.toThrow(
      ForbiddenException,
    );
    expect(empleados.find).not.toHaveBeenCalled();
  });

  it('consulta subordinados mediante jefeDirecto y solo carga columnas analiticas', async () => {
    empleados.findOne.mockResolvedValue({ idEmpleado: 10 });
    empleados.find.mockResolvedValue([
      { idEmpleado: 21, puesto: { idDepartamento: 3 }, dpi: 'NO_EXPONER' },
    ]);
    await expect(context.autorizarEquipo(usuario(2), 10)).resolves.toEqual([
      { idEmpleado: 21, idDepartamento: 3 },
    ]);
    expect(empleados.find).toHaveBeenCalledWith({
      where: { jefeDirecto: { idEmpleado: 10 }, isActive: true },
      select: {
        idEmpleado: true,
        puesto: { idPuesto: true, idDepartamento: true },
      },
      relations: { puesto: true },
      order: { idEmpleado: 'ASC' },
    });
  });

  it('filtra detalle de un subordinado en la consulta y rechaza a un ajeno', async () => {
    empleados.findOne
      .mockResolvedValueOnce({ idEmpleado: 10 })
      .mockResolvedValueOnce(null);
    await expect(context.autorizarEmpleado(usuario(2), 99)).rejects.toThrow(
      ForbiddenException,
    );
    expect(empleados.findOne).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          idEmpleado: 99,
          isActive: true,
          jefeDirecto: { idEmpleado: 10 },
        },
      }),
    );
  });

  it.each([3, 4])(
    'nivel %s puede consultar un empleado explicitamente sin vinculo personal',
    async (nivel) => {
      empleados.findOne.mockResolvedValue({
        idEmpleado: 21,
        puesto: { idDepartamento: 3 },
      });
      await expect(
        context.autorizarEmpleado(usuario(nivel, null), 21),
      ).resolves.toEqual({ idEmpleado: 21, idDepartamento: 3 });
      expect(empleados.findOne).toHaveBeenCalledTimes(1);
    },
  );

  it('rechaza encargado inexistente y actor desactivado', async () => {
    empleados.findOne.mockResolvedValue(null);
    await expect(context.autorizarEquipo(usuario(3), 10)).rejects.toThrow(
      NotFoundException,
    );
    await expect(context.autorizarEquipo(usuario(2), 10)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('catalogo conserva metas cero y KPI historicos inactivos', async () => {
    metricas.find.mockResolvedValue([
      {
        idMetrica: 4,
        idDepartamento: 3,
        codigoKpi: 'BOD_FACTURAS',
        nombreKpi: 'Facturas',
        unidadMedida: 'unidad',
        metaObjetivo: '0.00',
        tipoCalculo: 'SUMA',
        isActive: false,
      },
    ]);
    const catalogo = await context.obtenerCatalogo(
      [{ idEmpleado: 21, idDepartamento: 3 }],
      [4, 4],
    );
    expect(catalogo[0]).toMatchObject({ metaObjetivo: 0, activa: false });
    expect(metricas.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [
          {
            idDepartamento: In([3]),
            isActive: true,
          },
          { idMetrica: In([4]) },
        ],
      }),
    );
  });
});
