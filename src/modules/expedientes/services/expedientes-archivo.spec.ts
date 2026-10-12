import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ExpedientesService } from './expedientes.service';
import { DocumentStorageService } from './document-storage.service';
import { Expediente } from '../entities/expediente.entity';
import { DocumentoExpediente } from '../entities/documento-expediente.entity';
import { TipoDocumentoExpediente } from '../entities/tipo-documento-expediente.entity';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';

describe('Archivos de expedientes', () => {
  const findOne = jest.fn();
  const leerArchivo = jest.fn();
  const service = new ExpedientesService(
    {} as Repository<Expediente>,
    { findOne } as unknown as Repository<DocumentoExpediente>,
    {} as Repository<TipoDocumentoExpediente>,
    {} as Repository<Empleado>,
    { leerArchivo } as unknown as DocumentStorageService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    findOne.mockResolvedValue({ nombreOriginal: 'José.pdf', mimeType: 'application/pdf', rutaArchivo: 'archivo' });
    leerArchivo.mockResolvedValue(Buffer.from('contenido'));
  });

  it.each([false, true])('Entrega el contenido con descargar=%s', async (descargar) => {
    const archivo = await service.obtenerArchivo(1, 2, descargar);
    expect(archivo.getHeaders()).toEqual({
      type: 'application/pdf',
      disposition: `${descargar ? 'attachment' : 'inline'}; filename="Jos_.pdf"; filename*=UTF-8''Jos%C3%A9.pdf`,
      length: 9,
    });
    expect(findOne).toHaveBeenCalledWith({ where: {
      idDocumento: 2, idExpediente: 1, isActive: true, expediente: { isActive: true },
    } });
    const chunks: Buffer[] = [];
    for await (const chunk of archivo.getStream()) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe('contenido');
  });

  it('No lee archivos de documentos no encontrados en el expediente', async () => {
    findOne.mockResolvedValue(null);
    await expect(service.obtenerArchivo(1, 2, false)).rejects.toBeInstanceOf(NotFoundException);
    expect(leerArchivo).not.toHaveBeenCalled();
  });

  it('Rechaza la previsualización de tipos no admitidos', async () => {
    findOne.mockResolvedValue({ mimeType: 'text/html' });
    await expect(service.obtenerArchivo(1, 2, false)).rejects.toBeInstanceOf(BadRequestException);
    expect(leerArchivo).not.toHaveBeenCalled();
  });

  it('Propaga el error cuando falta el archivo físico', async () => {
    leerArchivo.mockRejectedValue(new NotFoundException());
    await expect(service.obtenerArchivo(1, 2, true)).rejects.toBeInstanceOf(NotFoundException);
  });
});
