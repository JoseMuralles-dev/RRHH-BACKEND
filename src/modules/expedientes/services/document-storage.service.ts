import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import {
  existsSync,
  mkdirSync,
  unlinkSync,
} from 'fs';

import { join, relative, isAbsolute } from 'path';
import { readFile, realpath, stat } from 'fs/promises';

@Injectable()
export class DocumentStorageService {
  async leerArchivo(rutaArchivo: string): Promise<Buffer> {
    try {
      const base = await realpath(this.basePath);
      const ruta = await realpath(rutaArchivo);
      const relativa = relative(base, ruta);
      if (relativa === '..' || relativa.startsWith('../') ||
          relativa.startsWith('..\\') || isAbsolute(relativa) ||
          !(await stat(ruta)).isFile()) {
        throw new NotFoundException('El archivo no está disponible');
      }
      return await readFile(ruta);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) {
        throw new NotFoundException('El archivo no está disponible');
      }
      throw new InternalServerErrorException('No fue posible leer el archivo');
    }
  }

  private readonly basePath = join(
    process.cwd(),
    'uploads',
    'expedientes',
  );

  obtenerDirectorioEmpleadoTipo(
    idEmpleado: number,
    codigoTipo: string,
  ): string {
    const directorio = join(
      this.basePath,
      String(idEmpleado),
      codigoTipo,
    );

    if (!existsSync(directorio)) {
      mkdirSync(directorio, {
        recursive: true,
      });
    }

    return directorio;
  }

  generarNombreArchivo(
    nombreOriginal: string,
  ): string {
    const extension =
      nombreOriginal.includes('.')
        ? nombreOriginal.substring(
            nombreOriginal.lastIndexOf('.'),
          )
        : '';

    return `${crypto.randomUUID()}${extension.toLowerCase()}`;
  }

  eliminarArchivo(
    rutaArchivo: string,
  ): void {
    try {
      if (existsSync(rutaArchivo)) {
        unlinkSync(rutaArchivo);
      }
    } catch {
      throw new InternalServerErrorException(
        'No fue posible eliminar el archivo físico',
      );
    }
  }
}
