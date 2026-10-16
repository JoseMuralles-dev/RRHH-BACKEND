import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Aplicar validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina propiedades no definidas en el DTO
      forbidNonWhitelisted: true, // Lanza error si hay propiedades no permitidas
      transform: true, // Transforma los datos automáticamente
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
   app.enableCors({
    origin: ['http://localhost:4200', 'https://5358p146-4200.use.devtunnels.ms', 'https://rrhh.intertornillos.com', 'https://rrhh.intertornillos.com:3000'],
    
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
  });

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST?.trim();

  if (host) {
    await app.listen(port, host);
  } else {
    await app.listen(port);
  }
}
bootstrap();
