import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';

import { renameSync } from 'fs';
import { writeFile, unlink } from 'fs/promises';
import { EditarDocumentoDto } from '../dto/editar-documento.dto';
import { join } from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Expediente } from '../entities/expediente.entity';
import { DocumentoExpediente } from '../entities/documento-expediente.entity';
import { TipoDocumentoExpediente } from '../entities/tipo-documento-expediente.entity';

import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { DocumentStorageService } from './document-storage.service';
import { SubirDocumentoDto } from '../dto/subir-documento.dto';
import { CrearExpedienteDto } from '../dto/crear-expediente.dto';

@Injectable()
export class ExpedientesService {
  async editarDocumento(id: number, dto: EditarDocumentoDto, idUsuario: number, archivo?: Express.Multer.File) {
    let rutaNueva: string | undefined;
    try {
      return await this.documentoRepository.manager.transaction(async manager => {
        const repo = manager.getRepository(DocumentoExpediente);
        const actual = await repo.findOne({ where: { idDocumento: id, isActive: true, expediente: { isActive: true } },
          relations: { expediente: true, tipoDocumento: true }, lock: { mode: 'pessimistic_write' } });
        if (!actual) throw new NotFoundException('Documento activo no encontrado');
        const datos = {
          fechaDocumento: dto.fechaDocumento ?? actual.fechaDocumento,
          fechaVencimiento: dto.fechaVencimiento ?? actual.fechaVencimiento,
          observaciones: dto.observaciones ?? actual.observaciones,
        };
        if (actual.tipoDocumento.requiereVencimiento && !datos.fechaVencimiento) {
          throw new BadRequestException('Este tipo de documento requiere fecha de vencimiento');
        }
        if (datos.fechaDocumento && datos.fechaVencimiento && datos.fechaDocumento > datos.fechaVencimiento) {
          throw new BadRequestException('El vencimiento no puede ser anterior a la fecha del documento');
        }
        if (!archivo) {
          Object.assign(actual, datos);
          return repo.save(actual);
        }
        const buffer = archivo.buffer;
        const valido = buffer?.length && buffer.length <= 100 * 1024 * 1024 && (
          (archivo.mimetype === 'application/pdf' && buffer.subarray(0, 5).toString() === '%PDF-') ||
          (archivo.mimetype === 'image/png' && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
          (archivo.mimetype === 'image/jpeg' && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255));
        if (!valido) throw new BadRequestException('El archivo debe ser un PDF, JPG o PNG valido de hasta 100 MB');
        const nombreArchivo = this.documentStorageService.generarNombreArchivo(
          archivo.mimetype === 'application/pdf' ? 'documento.pdf' : archivo.mimetype === 'image/png' ? 'documento.png' : 'documento.jpg');
        const ruta = join(this.documentStorageService.obtenerDirectorioEmpleadoTipo(actual.expediente.idEmpleado, actual.tipoDocumento.codigo), nombreArchivo);
        await writeFile(ruta, buffer, { flag: 'wx' });
        rutaNueva = ruta;
        // Reemplazar crea una nueva version: no borra el archivo ni la autoria originales.
        actual.isActive = false;
        await repo.save(actual);
        return repo.save(repo.create({
          idExpediente: actual.idExpediente, idTipoDocumento: actual.idTipoDocumento,
          ...datos, nombreOriginal: archivo.originalname, nombreArchivo, rutaArchivo: ruta,
          mimeType: archivo.mimetype, tamanoBytes: String(buffer.length),
          estado: 'VIGENTE', idUsuarioCarga: idUsuario, isActive: true,
        }));
      });
    } catch (error) {
      if (rutaNueva) await unlink(rutaNueva).catch(() => undefined);
      throw error;
    }
  }

  async desactivarDocumento(id: number) {
    const resultado = await this.documentoRepository.update({ idDocumento: id, isActive: true }, { isActive: false });
    if (!resultado.affected) throw new NotFoundException('Documento activo no encontrado');
    return { desactivado: true };
  }

  async autorizarLecturaPropia(idEmpleado: number | undefined, empleadoRuta?: string, expedienteRuta?: string) {
    if (!Number.isSafeInteger(idEmpleado) || !idEmpleado || idEmpleado < 1) {
      throw new ForbiddenException('Tu usuario no tiene un empleado asociado');
    }
    const empleado = await this.empleadoRepository.findOne({ where: { idEmpleado, isActive: true } });
    if (!empleado) throw new ForbiddenException('Empleado inexistente o inactivo');
    if (empleadoRuta !== undefined && Number(empleadoRuta) !== idEmpleado) {
      throw new ForbiddenException('Solo puedes consultar tu propio expediente');
    }
    if (expedienteRuta !== undefined) {
      const idExpediente = Number(expedienteRuta);
      if (!Number.isSafeInteger(idExpediente) || idExpediente < 1) throw new ForbiddenException('Expediente no autorizado');
      const propio = await this.expedienteRepository.findOne({ where: { idExpediente, idEmpleado, isActive: true } });
      if (!propio) throw new ForbiddenException('Solo puedes consultar tu propio expediente');
    }
  }
  async obtenerArchivo(idExpediente: number, idDocumento: number, descargar: boolean): Promise<StreamableFile> {
    const documento = await this.documentoRepository.findOne({
      where: {
        idDocumento,
        idExpediente,
        isActive: true,
        expediente: { isActive: true },
      },
    });
    if (!documento) {
      throw new NotFoundException('El documento indicado no existe en el expediente activo');
    }
    const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/png'];
    const tipo = documento.mimeType ?? 'application/octet-stream';
    if (!descargar && !tiposPermitidos.includes(tipo)) {
      throw new BadRequestException('Este tipo de archivo no admite previsualización');
    }
    const contenido = await this.documentStorageService.leerArchivo(documento.rutaArchivo);
    const nombre = documento.nombreOriginal.replace(/[\\/\r\n\x00-\x1f\x7f]/g, '_');
    const nombreAscii = nombre.replace(/[^a-zA-Z0-9._ -]/g, '_') || 'documento';
    const nombreUtf8 = encodeURIComponent(nombre || 'documento').replace(/['()*]/g,
      (caracter) => `%${caracter.charCodeAt(0).toString(16).toUpperCase()}`);
    return new StreamableFile(contenido, {
      type: tiposPermitidos.includes(tipo) ? tipo : 'application/octet-stream',
      disposition: `${descargar ? 'attachment' : 'inline'}; filename="${nombreAscii}"; filename*=UTF-8''${nombreUtf8}`,
      length: contenido.length,
    });
  }

  constructor(
    @InjectRepository(Expediente)
    private readonly expedienteRepository: Repository<Expediente>,

    @InjectRepository(DocumentoExpediente)
    private readonly documentoRepository: Repository<DocumentoExpediente>,

    @InjectRepository(TipoDocumentoExpediente)
    private readonly tipoDocumentoRepository: Repository<TipoDocumentoExpediente>,

    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    private readonly documentStorageService: DocumentStorageService,
  ) {}

  async crear(dto: CrearExpedienteDto): Promise<Expediente> {
    const empleado = await this.empleadoRepository.findOne({
      where: {
        idEmpleado: dto.idEmpleado,
        isActive: true,
      },
    });

    if (!empleado) {
      throw new NotFoundException(
        'El empleado indicado no existe o se encuentra inactivo',
      );
    }

    const existente = await this.expedienteRepository.findOne({
      where: {
        idEmpleado: dto.idEmpleado,
      },
    });

    if (existente) {
      throw new ConflictException(
        'El empleado ya posee un expediente',
      );
    }

    const expediente = this.expedienteRepository.create({
      idEmpleado: dto.idEmpleado,
      fechaApertura: dto.fechaApertura,
      estado: 'ACTIVO',
      observaciones: dto.observaciones ?? null,
      isActive: true,
    });

    return this.expedienteRepository.save(expediente);
  }

  async obtenerPorEmpleado(
    idEmpleado: number,
  ): Promise<Expediente> {
    const expediente = await this.expedienteRepository.findOne({
      where: {
        idEmpleado,
        isActive: true,
      },

      relations: {
        documentos: {
          tipoDocumento: true,
        },
      },
    });

    if (!expediente) {
      throw new NotFoundException(
        'No existe un expediente activo para este empleado',
      );
    }

    return expediente;
  }

  async listarTiposDocumento(): Promise<TipoDocumentoExpediente[]> {
    return this.tipoDocumentoRepository.find({
      where: {
        isActive: true,
      },

      order: {
        nombre: 'ASC',
      },
    });
  }
  async subirDocumento(
  idExpediente: number,
  dto: SubirDocumentoDto,
  archivo: Express.Multer.File,
  idUsuario: number,
) {
  if (!archivo) {
    throw new BadRequestException(
      'Debe adjuntar un archivo',
    );
  }

  const expediente = await this.expedienteRepository.findOne({
    where: {
      idExpediente,
      isActive: true,
    },
  });

  if (!expediente) {
    throw new NotFoundException(
      'El expediente indicado no existe',
    );
  }

  const tipoDocumento =
    await this.tipoDocumentoRepository.findOne({
      where: {
        idTipoDocumento: dto.idTipoDocumento,
        isActive: true,
      },
    });

  if (!tipoDocumento) {
    throw new NotFoundException(
      'El tipo de documento indicado no existe',
    );
  }

  if (
    tipoDocumento.requiereVencimiento &&
    !dto.fechaVencimiento
  ) {
    throw new BadRequestException(
      'Este tipo de documento requiere fecha de vencimiento',
    );
  }

  const directorioDestino =
    this.documentStorageService.obtenerDirectorioEmpleadoTipo(
      expediente.idEmpleado,
      tipoDocumento.codigo,
    );

  const nombreArchivo =
    this.documentStorageService.generarNombreArchivo(
      archivo.originalname,
    );

  const rutaFinal = join(
    directorioDestino,
    nombreArchivo,
  );

  renameSync(
    archivo.path,
    rutaFinal,
  );

  const documento = this.documentoRepository.create({
    idExpediente: expediente.idExpediente,
    idTipoDocumento: tipoDocumento.idTipoDocumento,

    nombreOriginal: archivo.originalname,
    nombreArchivo,

    rutaArchivo: rutaFinal,

    mimeType: archivo.mimetype,
    tamanoBytes: String(archivo.size),

    fechaDocumento:
      dto.fechaDocumento ?? null,

    fechaVencimiento:
      dto.fechaVencimiento ?? null,

    estado: 'VIGENTE',

    observaciones:
      dto.observaciones ?? null,

    idUsuarioCarga: idUsuario,

    isActive: true,
  });

  return this.documentoRepository.save(
    documento,
  );
}
  
}
