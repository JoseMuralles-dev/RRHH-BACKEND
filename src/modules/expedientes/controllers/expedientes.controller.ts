import {
  Body,
  BadRequestException,
  Delete,
  Patch,
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
import { ExpedientesAccesoGuard } from '../expedientes-acceso.guard';

import { ExpedientesService } from '../services/expedientes.service';
import { CrearExpedienteDto } from '../dto/crear-expediente.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { join } from 'path';
import { SubirDocumentoDto } from '../dto/subir-documento.dto';
import { diskStorage, memoryStorage } from 'multer';
import { EditarDocumentoDto } from '../dto/editar-documento.dto';
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
@UseGuards(JwtAuthGuard, ExpedientesAccesoGuard)
export class ExpedientesController {
  @Patch('documentos/:idDocumento')
  @UseInterceptors(FileInterceptor('archivo', {
    storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => {
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)) {
        return callback(new BadRequestException('Solo se permiten archivos PDF, JPG y PNG'), false);
      }
      callback(null, true);
    },
  }))
  editarDocumento(
    @Param('idDocumento', ParseIntPipe) id: number,
    @Body() dto: EditarDocumentoDto,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Req() req: { user: { idUsuario: number } },
  ) {
    return this.expedientesService.editarDocumento(id, dto, req.user.idUsuario, archivo);
  }

  @Delete('documentos/:idDocumento')
  desactivarDocumento(@Param('idDocumento', ParseIntPipe) id: number) {
    return this.expedientesService.desactivarDocumento(id);
  }

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
