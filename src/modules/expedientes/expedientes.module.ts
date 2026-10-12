import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Expediente } from './entities/expediente.entity';
import { DocumentoExpediente } from './entities/documento-expediente.entity';
import { TipoDocumentoExpediente } from './entities/tipo-documento-expediente.entity';

import { Empleado } from '../organization/empleados/entities/empleado.entity';
import { Usuario } from '../user/entities/user.entity';

import { ExpedientesController } from './controllers/expedientes.controller';
import { ExpedientesService } from './services/expedientes.service';
import { DocumentStorageService } from './services/document-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Expediente,
      DocumentoExpediente,
      TipoDocumentoExpediente,
      Empleado,
      Usuario,

    ]),
  ],

  controllers: [
    ExpedientesController,
  ],

  providers: [
    ExpedientesService,
    DocumentStorageService,
  ],

  exports: [
    ExpedientesService,
  ],
})
export class ExpedientesModule {}