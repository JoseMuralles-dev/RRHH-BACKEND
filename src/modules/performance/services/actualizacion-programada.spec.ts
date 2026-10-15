import { actualizarKpiProgramado, fechasActualizacion } from './actualizacion-programada';

describe('Actualizacion automatica de KPI', () => {
  it('usa ayer en Guatemala aunque UTC ya este en el dia siguiente', () => {
    expect(fechasActualizacion([], new Date('2026-10-15T02:00:00Z'))).toEqual(['2026-10-13']);
  });
  it('el primero del mes procesa el ultimo dia del anterior', () => {
    expect(fechasActualizacion([], new Date('2026-11-01T07:00:00Z'))).toEqual(['2026-10-31']);
  });
  it('permite recuperar un rango que cruza de mes', () => {
    expect(fechasActualizacion(['2026-08-31', '2026-09-01'])).toEqual(['2026-08-31', '2026-09-01']);
  });
  it.each([['2026-02-30'], ['2026-09-02', '2026-09-01'], ['2099-01-01']])('rechaza fechas invalidas %s', (...args) => {
    expect(() => fechasActualizacion(args)).toThrow();
  });
  function preparar() {
    const conexion = { connect: jest.fn(), query: jest.fn().mockResolvedValue([{ adquirido: 1 }]), release: jest.fn() };
    const data = { createQueryRunner: () => conexion, getRepository: () => ({ find: async () => Array(4).fill({ idDepartamento: 3 }) }) };
    const etl = { procesarMetricasBodega: jest.fn().mockResolvedValue({ filasSap: 2, registrosProcesados: 8, empleadosSinRelacion: [] }) };
    const calculador = { procesarEvaluacionesDepartamento: jest.fn().mockResolvedValue({ empleadosEvaluados: 2, empleadosSinDatos: [], errores: [] }) };
    const ejecutar = (fechas: string[]) => actualizarKpiProgramado(data as any, etl as any, calculador as any, fechas, jest.fn());
    return { conexion, etl, calculador, ejecutar };
  }
  it('carga cada dia antes de recalcular una vez cada mes', async () => {
    const { etl, calculador, conexion, ejecutar } = preparar();
    await ejecutar(['2026-08-30', '2026-08-31', '2026-09-01']);
    expect(etl.procesarMetricasBodega).toHaveBeenCalledTimes(3);
    expect(calculador.procesarEvaluacionesDepartamento.mock.calls).toEqual([[3, 2026, 8], [3, 2026, 9]]);
    expect(calculador.procesarEvaluacionesDepartamento.mock.invocationCallOrder[0]).toBeGreaterThan(etl.procesarMetricasBodega.mock.invocationCallOrder[2]);
    expect(conexion.release).toHaveBeenCalled();
  });
  it('no recalcula si falla SAP y libera el bloqueo', async () => {
    const { etl, calculador, conexion, ejecutar } = preparar();
    etl.procesarMetricasBodega.mockRejectedValue(new Error('SAP no disponible'));
    await expect(ejecutar(['2026-08-01'])).rejects.toThrow('SAP');
    expect(calculador.procesarEvaluacionesDepartamento).not.toHaveBeenCalled();
    expect(conexion.query).toHaveBeenLastCalledWith(expect.stringContaining('RELEASE_LOCK'));
    expect(conexion.release).toHaveBeenCalled();
  });
  it('no ejecuta dos tareas simultaneas', async () => {
    const { conexion, etl, ejecutar } = preparar();
    conexion.query.mockResolvedValue([{ adquirido: 0 }]);
    await expect(ejecutar(['2026-08-01'])).rejects.toThrow('otra actualizacion');
    expect(etl.procesarMetricasBodega).not.toHaveBeenCalled();
    expect(conexion.release).toHaveBeenCalled();
  });
  it('reporta como fallo una evaluacion parcialmente fallida', async () => {
    const { calculador, ejecutar } = preparar();
    calculador.procesarEvaluacionesDepartamento.mockResolvedValue({ empleadosEvaluados: 0, empleadosSinDatos: [], errores: [{ idEmpleado: 1 }] } as any);
    await expect(ejecutar(['2026-08-01'])).rejects.toThrow('algunos empleados');
  });
});
