import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { PerformanceService } from './modules/performance/services/performance.service';
import { EvaluacionKpiService } from './modules/performance/services/evaluacion-kpi.service';
import { actualizarKpiProgramado, fechasActualizacion } from './modules/performance/services/actualizacion-programada';

async function ejecutar() {
  const fechas = fechasActualizacion(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    await actualizarKpiProgramado(app.get(DataSource), app.get(PerformanceService), app.get(EvaluacionKpiService), fechas, console.log);
  } finally { await app.close(); }
}
ejecutar().catch(error => { console.error(error instanceof Error ? error.message : 'Error actualizando KPI'); process.exitCode = 1; });
