import { RolesModule } from './modules/roles/roles.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { EmpleadosModule } from './modules/organization/empleados/empleados.module';
import { SolicitudesModule } from './modules/solicitudes/solicitudes.module';
import { SapModule } from './modules/integrations/sap/sap.module';
import { PerformanceModule } from './modules/performance/performance.module';
import { KpiModule } from './modules/kpi/kpi.module';
import { DepartamentosModule } from './modules/organization/departamentos/departamentos.module';
import { PuestosModule } from './modules/organization/puestos/puestos.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
      }),
    }),
    AuthModule,
    RolesModule,
    EmpleadosModule,
    SolicitudesModule,
    SapModule,
    PerformanceModule,
    KpiModule,
    DepartamentosModule,
    PuestosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
