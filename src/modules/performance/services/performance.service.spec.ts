import { Repository } from 'typeorm';
import { PerformanceService } from './performance.service';
import { SapService } from '../../integrations/sap/sap.service';
import { MetricaKpi } from '../entities/metrica-kpi.entity';
import { MetricaKpiDiaria } from '../entities/metrica-kpi-diaria.entity';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';

describe('ETL de artículos con desglose', () => {
  it('guarda facturas y traslados con el total diario y reemplaza el desglose al reprocesar', async () => {
    const sap = { obtenerMetricasBodega: jest.fn().mockResolvedValue([{
      CodigoEmpleadoSap: '22', NombrePreparador: 'Preparador',
      TotalArticulos: '37788.25', TotalArticulosTraslados: '84550.95',
    }]) };
    const metricas = { find: jest.fn().mockResolvedValue([
      { idMetrica: 3, codigoKpi: 'BOD_ARTICULOS' },
    ]) };
    const empleados = { findOne: jest.fn().mockResolvedValue({ idEmpleado: 22 }) };
    const registro = { idRegistro: 10, valor: '1', desgloseOrigen: null };
    const diarias = { findOne: jest.fn().mockResolvedValue(registro), save: jest.fn() };
    const service = new PerformanceService(
      sap as unknown as SapService,
      metricas as unknown as Repository<MetricaKpi>,
      diarias as unknown as Repository<MetricaKpiDiaria>,
      empleados as unknown as Repository<Empleado>,
    );
    await service.procesarMetricasBodega('2026-08-01');
    expect(diarias.save).toHaveBeenCalledWith(expect.objectContaining({
      idRegistro: 10, valor: '122339.2', fuente: 'SAP', desgloseOrigen: [
        { origen: 'FACTURAS', valor: '37788.25' },
        { origen: 'TRASLADOS', valor: '84550.95' },
      ],
    }));
    sap.obtenerMetricasBodega.mockResolvedValue([{
      CodigoEmpleadoSap: '22', NombrePreparador: 'Preparador',
      TotalArticulos: '10', TotalArticulosTraslados: '20',
    }]);
    await service.procesarMetricasBodega('2026-08-01');
    expect(diarias.save).toHaveBeenLastCalledWith(expect.objectContaining({
      idRegistro: 10, valor: '30', desgloseOrigen: [
        { origen: 'FACTURAS', valor: '10.00' },
        { origen: 'TRASLADOS', valor: '20.00' },
      ],
    }));
  });
});
