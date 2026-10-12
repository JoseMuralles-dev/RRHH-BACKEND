import { NotFoundException } from '@nestjs/common';
import { PuestosService } from './puestos.service';

describe('Puestos: departamento y baja logica', () => {
  const puestos = { findOne: jest.fn(), find: jest.fn(), create: jest.fn(x => x), save: jest.fn(async x => x) };
  const departamentos = { findOne: jest.fn() };
  const service = new PuestosService(puestos as any, departamentos as any);
  beforeEach(() => {
    jest.clearAllMocks();
    puestos.findOne.mockResolvedValue({ idPuesto: 1, idDepartamento: 2, isActive: true });
    departamentos.findOne.mockResolvedValue({ idDepartamento: 2, isActive: true });
  });
  it('crea un puesto en departamento activo', async () => {
    expect(await service.create({ nombrePuesto: 'Bodeguero', salarioBase: '4000.00', idDepartamento: 2 })).toMatchObject({ isActive: true, idDepartamento: 2 });
    expect(departamentos.findOne).toHaveBeenCalledWith({ where: { idDepartamento: 2, isActive: true } });
  });
  it.each(['create', 'update'])('impide %s hacia departamento inexistente o inactivo', async action => {
    departamentos.findOne.mockResolvedValue(null);
    const dto = { nombrePuesto: 'Bodeguero', salarioBase: '4000.00', idDepartamento: 99 };
    await expect(action === 'create' ? service.create(dto) : service.update(1, dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(puestos.save).not.toHaveBeenCalled();
  });
  it('actualiza solo el nombre sin exigir cambio de departamento', async () => {
    expect(await service.update(1, { nombrePuesto: 'Encargado' })).toMatchObject({ nombrePuesto: 'Encargado', idDepartamento: 2 });
    expect(departamentos.findOne).not.toHaveBeenCalled();
  });
  it('no edita ni desactiva puestos ausentes', async () => {
    puestos.findOne.mockResolvedValue(null);
    await expect(service.update(1, {})).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.desactivar(1)).rejects.toBeInstanceOf(NotFoundException);
    expect(puestos.save).not.toHaveBeenCalled();
  });
  it('desactiva conservando el registro y lista solo activos', async () => {
    expect(await service.desactivar(1)).toMatchObject({ idPuesto: 1, isActive: false });
    await service.findAll();
    expect(puestos.find).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
  });
});
