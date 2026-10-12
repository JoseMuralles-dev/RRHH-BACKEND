import { ForbiddenException } from '@nestjs/common';
import { KpiService } from './kpi.service';

describe('Alcance KPI por jerarquia', () => {
  const repo = { find: jest.fn() };
  let service: KpiService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new KpiService(repo as any);
    repo.find.mockResolvedValue([{
      idEmpleado: 7, primerNombre: 'Ana', primerApellido: 'Perez',
      puesto: { idDepartamento: 3, departamento: { nombreDepartamento: 'Bodega' } },
    }]);
    jest.spyOn(service, 'obtenerDashboard').mockResolvedValue({ idEmpleado: 7 } as any);
  });
  it.each([3, 4])('nivel %s consulta todos sin exigir empleado asociado', async nivel => {
    const result = await service.obtenerDashboardEquipo(null, nivel, 2026, 10);
    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
    expect(result.alcance).toBe('TODOS_DEPARTAMENTOS');
    expect(result.empleados[0].empleado).toMatchObject({ idDepartamento: 3, departamento: 'Bodega' });
    expect(service.obtenerDashboard).toHaveBeenCalledWith(7, 2026, 10);
  });
  it('nivel 2 conserva exclusivamente los subordinados directos', async () => {
    const result = await service.obtenerDashboardEquipo(20, 2, 2026, 10);
    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true, jefeDirecto: { idEmpleado: 20 } },
    }));
    expect(result.alcance).toBe('EQUIPO');
  });
  it.each([undefined, null, 0, -1, 1.5])('encargado sin identificador valido %s no consulta', async id => {
    await expect(service.obtenerDashboardEquipo(id, 2, 2026, 10)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.find).not.toHaveBeenCalled();
  });
  it.each([undefined, 0, 1, 5])('nivel %s no accede a otros empleados', async nivel => {
    await expect(service.obtenerDashboardEquipo(20, nivel, 2026, 10)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.find).not.toHaveBeenCalled();
  });
});
