import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { readFile, realpath, stat } from 'fs/promises';
import { join } from 'path';
import { DocumentStorageService } from './document-storage.service';

jest.mock('fs', () => ({ ...jest.requireActual('fs'), existsSync: jest.fn(), mkdirSync: jest.fn(), unlinkSync: jest.fn() }));
jest.mock('fs/promises', () => ({ readFile: jest.fn(), realpath: jest.fn(), stat: jest.fn() }));

describe('Almacenamiento de expedientes (sistema de archivos simulado)', () => {
  const service = new DocumentStorageService();
  const base = join(process.cwd(), 'uploads', 'expedientes');
  beforeEach(() => {
    jest.resetAllMocks();
    (realpath as jest.Mock).mockImplementation(async path => path);
    (stat as jest.Mock).mockResolvedValue({ isFile: () => true });
    (readFile as jest.Mock).mockResolvedValue(Buffer.from('archivo'));
  });
  it('lee un archivo contenido en el directorio permitido', async () => {
    const path = join(base, '1', 'documento.pdf');
    await expect(service.leerArchivo(path)).resolves.toEqual(Buffer.from('archivo'));
    expect(readFile).toHaveBeenCalledWith(path);
  });
  it('rechaza una ruta fuera del directorio incluso despues de resolver enlaces', async () => {
    (realpath as jest.Mock).mockResolvedValueOnce(base).mockResolvedValueOnce(join(process.cwd(), '.env'));
    await expect(service.leerArchivo(join(base, 'enlace'))).rejects.toBeInstanceOf(NotFoundException);
    expect(readFile).not.toHaveBeenCalled();
  });
  it('no permite leer un directorio', async () => {
    (stat as jest.Mock).mockResolvedValue({ isFile: () => false });
    await expect(service.leerArchivo(base)).rejects.toBeInstanceOf(NotFoundException);
    expect(readFile).not.toHaveBeenCalled();
  });
  it.each(['ENOENT', 'ENOTDIR'])('traduce %s a archivo no encontrado', async code => {
    (realpath as jest.Mock).mockRejectedValue({ code });
    await expect(service.leerArchivo('ausente')).rejects.toBeInstanceOf(NotFoundException);
  });
  it('controla otros errores de lectura', async () => {
    (readFile as jest.Mock).mockRejectedValue({ code: 'EACCES' });
    await expect(service.leerArchivo(join(base, 'archivo'))).rejects.toBeInstanceOf(InternalServerErrorException);
  });
  it('crea el directorio solo si falta', () => {
    (existsSync as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(true);
    const path = service.obtenerDirectorioEmpleadoTipo(1, 'DPI');
    expect(path).toBe(join(base, '1', 'DPI'));
    service.obtenerDirectorioEmpleadoTipo(1, 'DPI');
    expect(mkdirSync).toHaveBeenCalledTimes(1);
  });
  it('genera nombres diferentes conservando la extension normalizada', () => {
    const a = service.generarNombreArchivo('documento.PDF');
    const b = service.generarNombreArchivo('documento.PDF');
    expect(a).toMatch(/^[\da-f-]+\.pdf$/);
    expect(a).not.toBe(b);
    expect(service.generarNombreArchivo('sin-extension')).not.toContain('.');
  });
  it('omite la eliminacion de ausentes y controla errores al eliminar', () => {
    (existsSync as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(true);
    service.eliminarArchivo('ausente');
    expect(unlinkSync).not.toHaveBeenCalled();
    (unlinkSync as jest.Mock).mockImplementation(() => { throw new Error('fallo'); });
    expect(() => service.eliminarArchivo('presente')).toThrow(InternalServerErrorException);
  });
});
