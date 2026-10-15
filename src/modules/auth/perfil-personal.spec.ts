import { UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { Usuario } from '../user/entities/user.entity';
describe('Perfil personal', () => {
  const repo = { findOne: jest.fn() };
  const service = new AuthService(repo as unknown as Repository<Usuario>, {} as JwtService);
  beforeEach(() => jest.resetAllMocks());
  it('consulta solo al usuario autenticado y devuelve sus datos sin credenciales', async () => {
    repo.findOne.mockResolvedValue({ idUsuario: 8, correo: 'usuario@ejemplo.com',
      passwordHash: 'privado', empleado: { idEmpleado: 19, primerNombre: 'Ana' } });
    const result = await service.perfilPersonal(8);
    expect(repo.findOne.mock.calls[0][0].where).toEqual({ idUsuario: 8, isActive: true, estado: 'ACTIVO' });
    expect(result.empleado?.idEmpleado).toBe(19);
    expect(result).not.toHaveProperty('passwordHash');
    expect(repo.findOne.mock.calls[0][0].select.empleado.jefeDirecto).not.toHaveProperty('sueldoActual');
  });
  it('permite cuentas sin empleado asociado', async () => {
    repo.findOne.mockResolvedValue({ idUsuario: 8, correo: 'admin@ejemplo.com' });
    expect((await service.perfilPersonal(8)).empleado).toBeNull();
  });
  it('rechaza usuarios inexistentes o inactivos', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.perfilPersonal(8)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('rechaza identificadores invalidos antes de consultar', async () => {
    await expect(service.perfilPersonal(NaN)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repo.findOne).not.toHaveBeenCalled();
  });
});
