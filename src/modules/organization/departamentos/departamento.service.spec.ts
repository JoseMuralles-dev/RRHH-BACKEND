import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DepartamentosService } from './departamento.service';
import { Departamento } from './entities/departamento.entity';

describe('DepartamentosService', () => {
  const repo = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(v => v), save: jest.fn(async v => v) };
  let service: DepartamentosService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new DepartamentosService(repo as unknown as Repository<Departamento>);
  });
  it('incluye los puestos relacionados al consultar el catálogo', async () => {
    repo.find.mockResolvedValue([]);
    await service.findAll();
    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ relations: { puestos: true } }));
  });
  it('crea un departamento activo', async () => {
    repo.findOne.mockResolvedValue(null);
    const result = await service.create({ nombreDepartamento: 'Bodega' });
    expect(result).toEqual({ nombreDepartamento: 'Bodega', isActive: true });
  });
  it('rechaza nombres duplicados al editar', async () => {
    repo.findOne.mockResolvedValueOnce({ idDepartamento: 1, nombreDepartamento: 'Bodega' })
      .mockResolvedValueOnce({ idDepartamento: 2, nombreDepartamento: 'Ventas' });
    await expect(service.update(1, { nombreDepartamento: 'Ventas' })).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('protege los departamentos con puestos activos al desactivar', async () => {
    repo.findOne.mockResolvedValue({ idDepartamento: 1, puestos: [{ isActive: true }] });
    await expect(service.desactivar(1)).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('desactiva sin eliminar el historial', async () => {
    repo.findOne.mockResolvedValue({ idDepartamento: 1, isActive: true, puestos: [{ isActive: false }] });
    expect(await service.desactivar(1)).toEqual(expect.objectContaining({ isActive: false }));
  });
  it('devuelve 404 para un registro inexistente', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
  });
});
