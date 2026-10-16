import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { Usuario } from '../user/entities/user.entity';
import { UsoEvento } from './uso-evento.entity';
import { UsoService } from './uso.service';
import { UsoInterceptor } from './uso.interceptor';
import { UsoController } from './uso.controller';
@Module({imports:[ConfigModule,AuthModule,TypeOrmModule.forFeature([UsoEvento,Usuario])],
  controllers:[UsoController],providers:[UsoService,{provide:APP_INTERCEPTOR,useClass:UsoInterceptor}]})
export class UsoModule {}
