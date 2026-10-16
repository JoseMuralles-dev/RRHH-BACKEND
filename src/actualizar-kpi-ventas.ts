import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { VentasService } from './modules/kpi/ventas/ventas.service';
import { fechasActualizacion } from './modules/performance/services/actualizacion-programada';

async function ejecutar() {
  const fechas = fechasActualizacion(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
  try {
    const id = Number(app.get(ConfigService).get('KPI_VENTAS_USUARIO_ID'));
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Configura KPI_VENTAS_USUARIO_ID con un usuario activo RRHH/administrador');
    let errores = 0;
    for (const fecha of fechas) {
      const resumen = await app.get(VentasService).actualizar(id, fecha);
      console.log(JSON.stringify(resumen));
      errores += resumen.errores.length;
    }
    if (errores) throw new Error('Carga parcial: revisar empleados reportados y reprocesar');
  } finally { await app.close(); }
}
ejecutar().catch(() => {
  // No imprimir excepciones del driver con parametros o credenciales.
  console.error('No se completo la actualizacion de Ventas. Revisar configuracion, SAP, tablas y resumen de errores.');
  process.exitCode = 1;
});
