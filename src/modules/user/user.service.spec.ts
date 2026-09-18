import { plainToInstance } from 'class-transformer';
import { EstadoUsuario } from './estado-usuario.enum';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsuariosService } from './user.service';
import { Usuario } from './entities/user.entity';
import { UserController } from './user.controller';
import { MIN_LEVEL_KEY } from '../../common/decorators/min-level/min-level.decorator';
import { validate } from 'class-validator';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

describe('UsuariosService', () => {
  let service: UsuariosService;
  const repo = { find: jest.fn(), findOne: jest.fn(), update: jest.fn() };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new UsuariosService(repo as unknown as Repository<Usuario>);
  });

  it.each([true, false])('updates active status to %s and returns inactive users too', async (isActive) => {
    const usuario = { idUsuario: 1, isActive: !isActive };
    repo.findOne.mockResolvedValueOnce(usuario).mockResolvedValueOnce({ ...usuario, isActive });
    const result = await service.update(1, { isActive });
    expect(repo.update).toHaveBeenCalledWith(1, {
      isActive, estado: isActive ? EstadoUsuario.ACTIVO : EstadoUsuario.INACTIVO,
    });
    expect(repo.findOne).toHaveBeenNthCalledWith(1, { where: { idUsuario: 1 } });
    expect(repo.findOne).toHaveBeenNthCalledWith(2, { where: { idUsuario: 1 } });
    expect(result.isActive).toBe(isActive);
  });

  it('keeps active-only lookups for password changes', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.changePassword(1, { password: 'claveNueva123' })).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { idUsuario: 1, isActive: true } });
  });

  it('lists inactive accounts for administration', async () => {
    repo.find.mockResolvedValue([{ idUsuario: 1, isActive: false }]);
    expect(await service.findAll()).toEqual([{ idUsuario: 1, isActive: false }]);
    expect(repo.find.mock.calls[0][0].where).toBeUndefined();
  });

  it.each([false, true])('accepts JSON boolean %s with implicit conversion enabled', async (isActive) => {
    const dto = plainToInstance(UpdateUsuarioDto, { isActive }, { enableImplicitConversion: true });
    expect(await validate(dto)).toEqual([]);
    expect(dto.isActive).toBe(isActive);
  });

  it.each([null, 0, 1, 'false', 'true'])('rejects invalid active flag %s', async (isActive) => {
    const dto = plainToInstance(UpdateUsuarioDto, { isActive }, { enableImplicitConversion: true });
    expect((await validate(dto)).map(error => error.property)).toContain('isActive');
  });

  it('rejects password fields on the general update DTO', async () => {
    const dto = plainToInstance(UpdateUsuarioDto, { isActive: true, password: 'claveNueva123', passwordHash: 'hash' });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map(error => error.property)).toEqual(expect.arrayContaining(['password', 'passwordHash']));
  });

  it('requires administrative level on the controller', () => {
    expect(Reflect.getMetadata(MIN_LEVEL_KEY, UserController)).toBe(4);
  });

  it('rejects a duplicate email without updating', async () => {
    repo.findOne
      .mockResolvedValueOnce({ idUsuario: 1 })
      .mockResolvedValueOnce({ idUsuario: 2 });
    await expect(
      service.update(1, { correo: 'otro@example.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('allows unlinking an employee explicitly', async () => {
    repo.findOne.mockResolvedValue({ idUsuario: 1, idEmpleado: null });
    await service.update(1, { idEmpleado: null });
    expect(repo.update).toHaveBeenCalledWith(1, { idEmpleado: null });
  });

  it('rejects empty updates', async () => {
    repo.findOne.mockResolvedValue({ idUsuario: 1 });
    await expect(service.update(1, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('hashes the password and returns only a confirmation', async () => {
    repo.findOne.mockResolvedValue({ idUsuario: 1 });
    const result = await service.changePassword(1, {
      password: 'claveNueva123',
    });
    const saved = repo.update.mock.calls[0][1];
    expect(await bcrypt.compare('claveNueva123', saved.passwordHash)).toBe(
      true,
    );
    expect(Object.keys(result)).toEqual(['message']);
  });

  it('does not change passwords of missing or inactive users', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(
      service.changePassword(1, { password: 'claveNueva123' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('rejects passwords exceeding the bcrypt byte limit', async () => {
    repo.findOne.mockResolvedValue({ idUsuario: 1 });
    await expect(
      service.changePassword(1, { password: 'á'.repeat(40) }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('rejects null email and role, but accepts null employee', async () => {
    const invalid = Object.assign(new UpdateUsuarioDto(), {
      correo: null,
      idRol: null,
    });
    expect((await validate(invalid)).map((error) => error.property)).toEqual([
      'correo',
      'idRol',
    ]);
    expect(
      await validate(
        Object.assign(new UpdateUsuarioDto(), { idEmpleado: null }),
      ),
    ).toEqual([]);
  });
});
