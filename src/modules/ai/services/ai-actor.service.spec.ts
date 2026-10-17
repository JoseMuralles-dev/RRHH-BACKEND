import { ForbiddenException } from '@nestjs/common';
import { AiActorService } from './ai-actor.service';
import { EstadoUsuario } from '../../user/estado-usuario.enum';

describe('AiActorService', () => {
  it('rechaza usuarios inactivos o roles deshabilitados', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new AiActorService(repo as any, {} as any);
    await expect(service.obtener(7)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { idUsuario: 7, isActive: true, estado: EstadoUsuario.ACTIVO },
    }));
    repo.findOne.mockResolvedValue({ idUsuario: 7, rol: { isActive: false, nivelJerarquico: 2 } });
    await expect(service.obtener(7)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('el contexto sale de la base de datos y no de claims antiguos', async () => {
    const service = new AiActorService({ findOne: async () => ({
      idUsuario: 7, idEmpleado: 3, rol: { isActive: true, nivelJerarquico: 1 },
    }) } as any, {} as any);
    expect(await service.obtener(7)).toEqual({ idUsuario: 7, idEmpleado: 3, nivelJerarquico: 1 });
  });
  it('invalida el historial cuando cambia el equipo', async () => {
    const contexto = { autorizarEquipo: jest.fn().mockResolvedValueOnce([{ idEmpleado: 8 }]).mockResolvedValueOnce([{ idEmpleado: 9 }]) };
    const service = new AiActorService({} as any, contexto as any);
    const actor = { idUsuario: 7, idEmpleado: 3, nivelJerarquico: 2 };
    expect(await service.alcance(actor)).not.toBe(await service.alcance(actor));
  });
});