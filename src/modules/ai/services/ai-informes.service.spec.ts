import { ConflictException, NotFoundException } from '@nestjs/common';
import { AiInformesService } from './ai-informes.service';

describe('AiInformesService', () => {
  const actor = { idUsuario: 7, idEmpleado: 3, nivelJerarquico: 2 };
  let repo: any, manager: any, runner: any, actores: any, ia: any, service: AiInformesService;
  beforeEach(() => {
    repo = { create: jest.fn(x => x), save: jest.fn(async x => ({ ...x, idInforme: 19 })),
      countBy: jest.fn().mockResolvedValue(0), find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null) };
    manager = { getRepository: () => repo };
    runner = { connect: jest.fn(), release: jest.fn(), manager, query: jest.fn().mockResolvedValue([{ adquirido: 1 }]) };
    actores = { obtener: jest.fn().mockResolvedValue(actor), alcance: jest.fn().mockResolvedValue('scope') };
    ia = { analizar: jest.fn().mockResolvedValue({ ok: true, respuesta: 'Resumen', periodo: { anio: 2026, mes: 8 } }) };
    service = new AiInformesService({ createQueryRunner: () => runner, getRepository: () => repo } as any, actores, ia);
  });
  it('consulta con identidad recargada y guarda respuesta', async () => {
    await service.consultar({ anio: 2026, mes: 8, pregunta: 'Analizar' }, 7);
    expect(ia.analizar.mock.calls[0][1]).toEqual(actor);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ idUsuario: 7, alcance: 'scope' }));
    expect(runner.release).toHaveBeenCalled();
  });
  it('no guarda resultados si cambian los permisos durante el análisis', async () => {
    actores.alcance.mockResolvedValueOnce('old').mockResolvedValueOnce('new');
    await expect(service.consultar({ anio: 2026, mes: 8, pregunta: 'Analizar' }, 7)).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('no consulta IA si otro proceso tiene el lock', async () => {
    runner.query.mockResolvedValue([{ adquirido: 0 }]);
    await expect(service.consultar({ anio: 2026, mes: 8, pregunta: 'Analizar' }, 7)).rejects.toBeInstanceOf(ConflictException);
    expect(ia.analizar).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });
  it('no persiste fallos y libera el lock', async () => {
    ia.analizar.mockRejectedValue(new Error('offline'));
    await expect(service.consultar({ anio: 2026, mes: 8, pregunta: 'Analizar' }, 7)).rejects.toThrow('offline');
    expect(repo.save).not.toHaveBeenCalled();
    expect(runner.query).toHaveBeenLastCalledWith('SELECT RELEASE_LOCK(?)', ['rrhh:ia:7']);
  });
  it('filtra informe por propietario y alcance actual', async () => {
    await expect(service.obtener(99, 7)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { idInforme: 99, idUsuario: 7, alcance: 'scope' } });
  });
  it('limita consultas antes de llamar al proveedor', async () => {
    repo.countBy.mockResolvedValue(20);
    await expect(service.consultar({ anio: 2026, mes: 8, pregunta: 'Analizar' }, 7)).rejects.toMatchObject({ status: 429 });
    expect(ia.analizar).not.toHaveBeenCalled();
  });
});