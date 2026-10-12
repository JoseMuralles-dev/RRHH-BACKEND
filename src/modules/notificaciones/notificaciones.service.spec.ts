import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Notificacion } from './entities/notificacion.entity';
import { Empleado } from '../organization/empleados/entities/empleado.entity';
import { Usuario } from '../user/entities/user.entity';
import { NotificacionesService } from './notificaciones.service';

describe('NotificacionesService', () => {
  const repo = { find: jest.fn(), count: jest.fn(), update: jest.fn(), findOne: jest.fn() };
  const source = { getRepository: jest.fn(() => repo) };
  const service = new NotificacionesService(source as unknown as DataSource);
  beforeEach(() => jest.resetAllMocks());
  beforeEach(() => source.getRepository.mockReturnValue(repo));

  it.each([undefined, null, 0, -1, NaN, 1.5])('rechaza destinatario invalido %s antes de consultar', async id => {
    await expect(service.obtenerMias(id as number)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.contarNoLeidas(id as number)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.marcarComoLeida(1, id as number)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.marcarTodasComoLeidas(id as number)).rejects.toBeInstanceOf(ForbiddenException);
    expect(source.getRepository).not.toHaveBeenCalled();
  });

  it('cuenta solo pendientes activas del destinatario', async () => {
    repo.count.mockResolvedValue(3);
    await expect(service.contarNoLeidas(7)).resolves.toEqual({ noLeidas: 3 });
    expect(repo.count).toHaveBeenCalledWith({ where: { idUsuarioDestinatario: 7, leida: false, isActive: true } });
  });

  it('marca todas en una operacion y devuelve las filas afectadas', async () => {
    repo.update.mockResolvedValue({ affected: 2 });
    await expect(service.marcarTodasComoLeidas(7)).resolves.toEqual({ actualizadas: 2 });
    expect(repo.update).toHaveBeenCalledWith(
      { idUsuarioDestinatario: 7, leida: false, isActive: true },
      { leida: true, fechaLectura: expect.any(Date) },
    );
  });

  it('no permite leer una notificacion ajena', async () => {
    repo.update.mockResolvedValue({ affected: 0 });
    repo.findOne.mockResolvedValue(null);
    await expect(service.marcarComoLeida(8, 7)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.update.mock.calls[0][0]).toEqual({ idNotificacion: 8, idUsuarioDestinatario: 7, isActive: true, leida: false });
    expect(repo.findOne).toHaveBeenCalledWith({ where: { idNotificacion: 8, idUsuarioDestinatario: 7, isActive: true } });
  });

  it('conserva la primera fecha de lectura', async () => {
    const original = { idNotificacion: 8, leida: true, fechaLectura: new Date('2026-01-01') };
    repo.update.mockResolvedValue({ affected: 0 });
    repo.findOne.mockResolvedValue(original);
    await expect(service.marcarComoLeida(8, 7)).resolves.toBe(original);
    expect(repo.update.mock.calls[0][0].leida).toBe(false);
  });
});

describe('Notificaciones dentro de la transaccion de solicitudes', () => {
  const empleados = { findOne: jest.fn() };
  const usuarios = { findOne: jest.fn() };
  const notificaciones = { create: jest.fn(x => x), save: jest.fn(async x => x) };
  const manager = { getRepository: jest.fn(entity => {
    if (entity === Empleado) return empleados;
    if (entity === Usuario) return usuarios;
    if (entity === Notificacion) return notificaciones;
    throw new Error('Repositorio inesperado');
  }) } as unknown as EntityManager;
  const source = { getRepository: jest.fn() };
  const service = new NotificacionesService(source as unknown as DataSource);
  beforeEach(() => {
    jest.clearAllMocks();
    usuarios.findOne.mockResolvedValue({ idUsuario: 9 });
    empleados.findOne.mockReset();
  });
  it('avisa al jefe de la solicitud creada con el mismo manager', async () => {
    empleados.findOne.mockResolvedValueOnce({ idJefeDirecto: 2, primerNombre: 'Ana', primerApellido: 'Perez' })
      .mockResolvedValueOnce({ idEmpleado: 2 });
    expect(await service.notificarNuevaSolicitud(manager, 1, 7)).toMatchObject({
      idUsuarioDestinatario: 9, referenciaId: 7, tipo: 'SOLICITUD_CREADA', leida: false,
    });
    expect(notificaciones.save).toHaveBeenCalledTimes(1);
    expect(source.getRepository).not.toHaveBeenCalled();
  });
  it.each(['notificarSolicitudAprobada', 'notificarSolicitudRechazada'] as const)('notifica al solicitante mediante %s', async metodo => {
    const result = await service[metodo](manager, 1, 7);
    expect(result).toMatchObject({ idUsuarioDestinatario: 9, referenciaId: 7, referenciaTipo: 'SOLICITUD_INCIDENCIA' });
    expect(usuarios.findOne).toHaveBeenCalledWith({ where: { idEmpleado: 1, isActive: true } });
    expect(source.getRepository).not.toHaveBeenCalled();
  });
  it('no inventa destinatario si el empleado no tiene cuenta', async () => {
    usuarios.findOne.mockResolvedValue(null);
    await expect(service.notificarSolicitudAprobada(manager, 1, 7)).resolves.toBeNull();
    expect(notificaciones.save).not.toHaveBeenCalled();
  });
  it('propaga el fallo de escritura para que el llamador pueda revertir la transaccion', async () => {
    notificaciones.save.mockRejectedValueOnce(new Error('Escritura fallida'));
    await expect(service.notificarSolicitudAprobada(manager, 1, 7)).rejects.toThrow('Escritura fallida');
  });
});
