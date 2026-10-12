import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../../common/guards/jwt/jwt-auth.guard';

import { ExpedientesService } from '../services/expedientes.service';
import { CrearExpedienteDto } from '../dto/crear-expediente.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { join } from 'path';
import { SubirDocumentoDto } from '../dto/subir-documento.dto';
import { diskStorage } from 'multer';
import {existsSync, mkdirSync,} from 'fs';
const tempPath = join(
  process.cwd(),
  'uploads',
  'temp',
);

if (!existsSync(tempPath)) {
  mkdirSync(tempPath, {
    recursive: true,
  });
}

@Controller('expedientes')
@UseGuards(JwtAuthGuard)
export class ExpedientesController {
  @Get(':idExpediente/documentos/:idDocumento/previsualizar')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  previsualizarDocumento(
    @Param('idExpediente', ParseIntPipe) idExpediente: number,
    @Param('idDocumento', ParseIntPipe) idDocumento: number,
  ) {
    return this.expedientesService.obtenerArchivo(idExpediente, idDocumento, false);
  }

  @Get(':idExpediente/documentos/:idDocumento/descargar')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  descargarDocumento(
    @Param('idExpediente', ParseIntPipe) idExpediente: number,
    @Param('idDocumento', ParseIntPipe) idDocumento: number,
  ) {
    return this.expedientesService.obtenerArchivo(idExpediente, idDocumento, true);
  }

  constructor(
    private readonly expedientesService: ExpedientesService,
    
  ) {}
  

  @Post()
  crear(
    @Body() dto: CrearExpedienteDto,
  ) {
    return this.expedientesService.crear(dto);
  }

  @Get('tipos-documento')
  listarTiposDocumento() {
    return this.expedientesService.listarTiposDocumento();
  }

  @Get('empleado/:idEmpleado')
  obtenerPorEmpleado(
    @Param(
      'idEmpleado',
      ParseIntPipe,
    )
    idEmpleado: number,
  ) {
    return this.expedientesService.obtenerPorEmpleado(
      idEmpleado,
    );
  }
  @Post(':idExpediente/documentos')
  @UseInterceptors(
  FileInterceptor('archivo', {
    storage: diskStorage({
      destination: tempPath,

      filename: (
        req,
        file,
        callback,
      ) => {
        const nombreTemporal =
          `${Date.now()}-${Math.round(
            Math.random() * 1e9,
          )}`;

        callback(
          null,
          nombreTemporal,
        );
      },
    }),

    limits: {
      fileSize: 10 * 1024 * 1024,
    },

    fileFilter: (
      req,
      file,
      callback,
    ) => {
      const permitidos = [
        'application/pdf',
        'image/jpeg',
        'image/png',
      ];

      if (!permitidos.includes(file.mimetype)) {
        return callback(
          new Error(
            'Solo se permiten archivos PDF, JPG y PNG',
          ),
          false,
        );
      }

      callback(null, true);
    },
  }),
)
subirDocumento(
  @Param(
    'idExpediente',
    ParseIntPipe,
  )
  idExpediente: number,

  @Body()
  dto: SubirDocumentoDto,

  @UploadedFile()
  archivo: Express.Multer.File,

  @Req()
  request: {
    user: {
      idUsuario: number;
    };
  },
) {
  return this.expedientesService.subirDocumento(
    idExpediente,
    dto,
    archivo,
    request.user.idUsuario,
  );
}
}
