import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AiAutomaticoService } from './modules/ai/services/ai-automatico.service';

async function ejecutar() {
  // Sin argumentos usa mes actual de Guatemala, independiente de la zona del servidor.
  const partes = new Intl.DateTimeFormat('en', { timeZone: 'America/Guatemala', year: 'numeric', month: 'numeric' }).formatToParts(new Date());
  const args = process.argv.slice(2);
  if (args.length !== 0 && args.length !== 2) throw new Error('Uso: node dist/generar-informes-ia.js [anio mes]');
  const anio = Number(args[0] ?? partes.find(p => p.type === 'year')!.value);
  const mes = Number(args[1] ?? partes.find(p => p.type === 'month')!.value);
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const resultado = await app.get(AiAutomaticoService).ejecutar(anio, mes);
    console.log(JSON.stringify(resultado));
    if (resultado.errores) process.exitCode = 1;
  } finally { await app.close(); }
}
ejecutar().catch(() => { console.error('No se pudieron generar los informes IA. Revisa configuración y migración.'); process.exitCode = 1; });