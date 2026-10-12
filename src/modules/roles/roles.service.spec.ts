import { ConflictException, NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';

describe('Roles', () => {
  const repo = { findOne: jest.fn(), find: jest.fn(), create: jest.fn(x => x), save: jest.fn(async x => x) };
  const service = new RolesService(repo as any);
  const dto = { codigoRol: 'PRUEBA', nombreRol: 'Prueba', nivelJerarquico: 1 };
  beforeEach(() => { jest.clearAllMocks(); repo.findOne.mockResolvedValue(null); });
  it('crea un rol activo', async () => {
    expect(await service.create(dto)).toMatchObject({ ...dto, isActive: true });
  });
  it.each([true, false])('no duplica codigo aunque el rol tenga isActive=%s', async isActive => {
    repo.findOne.mockResolvedValue({ ...dto, isActive });
    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('no actualiza un rol inexistente', async () => {
    await expect(service.update(99, { nombreRol: 'Nuevo' })).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('actualiza y desactiva conservando la identidad', async () => {
    repo.findOne.mockResolvedValue({ idRol: 1, ...dto, isActive: true });
    expect(await service.update(1, { nombreRol: 'Nuevo' })).toMatchObject({ idRol: 1, nombreRol: 'Nuevo' });
    expect(await service.desactivar(1)).toMatchObject({ idRol: 1, isActive: false });
  });
  it('lista roles activos ordenados por jerarquia', async () => {
    await service.findAll();
    expect(repo.find).toHaveBeenCalledWith({ where: { isActive: true }, order: { nivelJerarquico: 'ASC' } });
  });
});
