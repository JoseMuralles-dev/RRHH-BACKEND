import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';
import { SapService } from './sap.service';

jest.mock('mssql', () => ({ ConnectionPool: jest.fn(), Date: 'Date' }));

describe('SAP: parametros y cierre de conexiones (driver simulado)', () => {
  const req = { input: jest.fn().mockReturnThis(), execute: jest.fn() };
  const pool = {
    connect: jest.fn(),
    request: jest.fn(() => req),
    close: jest.fn(),
  };
  const service = new SapService({
    get: () => undefined,
    getOrThrow: () => 'test-only',
  } as unknown as ConfigService);
  beforeEach(() => {
    jest.clearAllMocks();
    (sql.ConnectionPool as unknown as jest.Mock).mockImplementation(() => pool);
    pool.connect.mockResolvedValue(pool);
    req.execute.mockResolvedValue({ recordset: [{ CodigoEmpleadoSap: 1 }] });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  it('usa parametros de fecha y cierra al terminar', async () => {
    expect(
      await service.obtenerMetricasBodega('2026-10-01', '2026-10-02'),
    ).toEqual([{ CodigoEmpleadoSap: 1 }]);
    expect(req.input).toHaveBeenCalledWith(
      'FechaInicial',
      sql.Date,
      '2026-10-01',
    );
    expect(req.input).toHaveBeenCalledWith(
      'FechaFinal',
      sql.Date,
      '2026-10-02',
    );
    expect(req.execute).toHaveBeenCalledWith(
      '_SBOSP_RPT_Reporte_Tracking_Bodega_ETL',
    );
    expect(pool.close).toHaveBeenCalledTimes(1);
  });
  it('cierra tambien ante errores de consulta y devuelve error controlado', async () => {
    req.execute.mockRejectedValue(new Error('Fallo interno SQL'));
    await expect(
      service.obtenerMetricasBodega('2026-10-01', '2026-10-02'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(pool.close).toHaveBeenCalledTimes(1);
  });
  it('no ejecuta consultas cuando falla la conexion', async () => {
    pool.connect.mockRejectedValue(new Error('Conexion rechazada'));
    await expect(
      service.obtenerMetricasBodega('2026-10-01', '2026-10-02'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(req.execute).not.toHaveBeenCalled();
  });
});
