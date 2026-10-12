import { ExpedientesService } from './expedientes.service';
import { writeFile, unlink } from 'fs/promises';

jest.mock('fs/promises', () => ({ writeFile: jest.fn(), unlink: jest.fn() }));

describe('Edicion de documentos', () => {
  let actual: any;
  let service: ExpedientesService;
  const repo = { findOne: jest.fn(), save: jest.fn(), create: jest.fn(), update: jest.fn() };
  const transaction = jest.fn();
  const archivo = { buffer: Buffer.from('%PDF-1.4 prueba'), mimetype: 'application/pdf', originalname: 'nuevo.pdf' } as Express.Multer.File;
  beforeEach(() => {
    jest.resetAllMocks();
    actual = { idDocumento: 1, idExpediente: 2, idTipoDocumento: 3, isActive: true,
      idUsuarioCarga: 7, rutaArchivo: 'original.pdf', fechaDocumento: '2026-01-01',
      expediente: { idEmpleado: 4 }, tipoDocumento: { codigo: 'DPI', requiereVencimiento: false } };
    repo.findOne.mockResolvedValue(actual);
    repo.save.mockImplementation(async x => x);
    repo.create.mockImplementation(x => x);
    transaction.mockImplementation(fn => fn({ getRepository: () => repo }));
    (writeFile as jest.Mock).mockResolvedValue(undefined);
    (unlink as jest.Mock).mockResolvedValue(undefined);
    service = new ExpedientesService({} as any, { ...repo, manager: { transaction } } as any, {} as any, {} as any,
      { generarNombreArchivo: () => 'nuevo.pdf', obtenerDirectorioEmpleadoTipo: () => 'simulado' } as any);
  });
  it('corrige datos sin reemplazar el archivo ni su autor', async () => {
    const result = await service.editarDocumento(1, { observaciones: 'Corregido' }, 8);
    expect(result).toMatchObject({ observaciones: 'Corregido', rutaArchivo: 'original.pdf', idUsuarioCarga: 7, isActive: true });
    expect(writeFile).not.toHaveBeenCalled();
  });
  it('conserva el original inactivo y registra el reemplazo con su autor', async () => {
    const result = await service.editarDocumento(1, {}, 8, archivo);
    expect(actual).toMatchObject({ isActive: false, rutaArchivo: 'original.pdf', idUsuarioCarga: 7 });
    expect(result).toMatchObject({ isActive: true, nombreOriginal: 'nuevo.pdf', idUsuarioCarga: 8, fechaDocumento: '2026-01-01' });
    expect(unlink).not.toHaveBeenCalled();
  });
  it('rechaza contenido falso antes de escribir o desactivar', async () => {
    await expect(service.editarDocumento(1, {}, 8, { ...archivo, buffer: Buffer.from('falso') })).rejects.toThrow('El archivo debe');
    expect(writeFile).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('limpia el archivo nuevo si falla la transaccion', async () => {
    repo.save.mockRejectedValue(new Error('fallo BD'));
    await expect(service.editarDocumento(1, {}, 8, archivo)).rejects.toThrow('fallo BD');
    expect(unlink).toHaveBeenCalledWith(expect.stringContaining('nuevo.pdf'));
  });
  it('rechaza fechas invertidas', async () => {
    await expect(service.editarDocumento(1, { fechaVencimiento: '2025-01-01' }, 8)).rejects.toThrow('El vencimiento');
  });
  it('no edita documentos inactivos', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.editarDocumento(1, {}, 8)).rejects.toThrow('Documento activo no encontrado');
  });
  it('desactiva sin borrar archivos', async () => {
    repo.update.mockResolvedValue({ affected: 1 });
    await expect(service.desactivarDocumento(1)).resolves.toEqual({ desactivado: true });
    expect(repo.update).toHaveBeenCalledWith({ idDocumento: 1, isActive: true }, { isActive: false });
    expect(unlink).not.toHaveBeenCalled();
  });
});
