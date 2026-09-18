import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EmpleadosService } from './empleados.service';
import { Empleado } from './entities/empleado.entity';
import { Puesto } from '../puestos/entities/puesto.entity';

describe('EmpleadosService', () => {
  const empleados = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const puestos = { findOne: jest.fn() };
  let service: EmpleadosService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new EmpleadosService(
      empleados as unknown as Repository<Empleado>,
      puestos as unknown as Repository<Puesto>,
    );
  });

  it('returns an empty search without querying when text is missing or blank', async () => {
    expect(await service.buscar()).toEqual([]);
    expect(await service.buscar('   ')).toEqual([]);
    expect(empleados.find).not.toHaveBeenCalled();
  });

  it('rejects non-string search values', async () => {
    await expect(
      service.buscar(['a', 'b'] as unknown as string),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('builds select labels without missing name parts', async () => {
    empleados.find.mockResolvedValue([
      {
        idEmpleado: 1,
        primerNombre: 'Ana',
        segundoNombre: null,
        primerApellido: 'López',
      },
    ]);
    expect(await service.findForSelect()).toEqual([
      { idEmpleado: 1, nombreCompleto: 'Ana López' },
    ]);
  });

  it('allows creation without a SAP code without querying for null', async () => {
    puestos.findOne.mockResolvedValue({ idPuesto: 1 });
    empleados.findOne.mockResolvedValue(null);
    const dto = {
      idPuesto: 1,
      primerNombre: 'Ana',
      primerApellido: 'López',
      dpi: '1234567890123',
      igss: '123',
      fechaNacimiento: '1990-01-01',
      fechaIngreso: '2026-01-01',
      sueldoActual: '5000.00',
      codigoSapEmpleado: null,
    };
    empleados.create.mockImplementation((value) => value);
    await service.create(dto);
    expect(empleados.findOne).toHaveBeenCalledTimes(2);
    expect(empleados.save).toHaveBeenCalledWith(
      expect.objectContaining({ codigoSapEmpleado: null }),
    );
  });

  it('unlinks SAP and boss without persisting loaded relations', async () => {
    empleados.findOne.mockResolvedValue({
      idEmpleado: 1,
      codigoSapEmpleado: 5,
      jefeDirecto: { idEmpleado: 2 },
    });
    await service.update(1, { codigoSapEmpleado: null, idJefeDirecto: null });
    expect(empleados.update).toHaveBeenCalledWith(1, {
      codigoSapEmpleado: null,
      idJefeDirecto: null,
    });
    expect(empleados.save).not.toHaveBeenCalled();
    expect(empleados.findOne).toHaveBeenCalledTimes(2);
  });

  it('updates the position independently of the previously loaded relation', async () => {
    empleados.findOne.mockResolvedValue({
      idEmpleado: 1,
      puesto: { idPuesto: 1 },
    });
    puestos.findOne.mockResolvedValue({ idPuesto: 2 });
    await service.update(1, { idPuesto: 2 });
    expect(empleados.update).toHaveBeenCalledWith(1, { idPuesto: 2 });
  });
});
