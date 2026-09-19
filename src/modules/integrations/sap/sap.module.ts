import { Module } from '@nestjs/common';

import { SapController } from './sap.controller';
import { SapService } from './sap.service';

@Module({
  controllers: [
    SapController,
  ],

  providers: [
    SapService,
  ],

  exports: [
    SapService,
  ],
})
export class SapModule {}