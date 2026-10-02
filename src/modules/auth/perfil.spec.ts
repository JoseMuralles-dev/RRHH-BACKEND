import { AuthService } from './auth.service';

describe('Perfil del usuario autenticado', () => {
  const repo = { findOne: jest.fn() };
  const service = new AuthService(repo as any, {} as any);
  beforeEach(() => jest.clearAllMocks());
  it('devuelve el nombre completo sin exponer otros datos', async () => {
    repo.findOne.mockResolvedValue({ idUsuario: 5, correo: 'jose@empresa.com', passwordHash: 'privado',
      empleado: { primerNombre: 'José', segundoNombre: null, primerApellido: 'Pérez', segundoApellido: 'López' } });
    expect(await service.perfil(5)).toEqual({ idUsuario: 5, correo: 'jose@empresa.com', nombre: 'José Pérez López' });
    expect(repo.findOne.mock.calls[0][0].where).toEqual({ idUsuario: 5, isActive: true, estado: 'ACTIVO' });
  });
  it('usa el correo cuando no existe empleado asociado', async () => {
    repo.findOne.mockResolvedValue({ idUsuario: 1, correo: 'admin@empresa.com', empleado: null });
    expect((await service.perfil(1)).nombre).toBe('admin@empresa.com');
  });
  it('rechaza un identificador ausente antes de consultar', async () => {
    await expect(service.perfil(undefined as any)).rejects.toThrow();
    expect(repo.findOne).not.toHaveBeenCalled();
  });
  it('rechaza usuarios inactivos o inexistentes', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.perfil(5)).rejects.toThrow();
  });
});
