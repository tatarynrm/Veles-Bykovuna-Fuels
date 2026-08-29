import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Validate + coerce query/body DTOs. Only endpoints that type a param as a DTO
  // class are affected (currently the transactions query); plain @Query('x')
  // string params on the other controllers pass through untouched. `transform`
  // turns `?page=2` into a number; `whitelist` drops unknown keys.
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, transformOptions: { enableImplicitConversion: false } }),
  );

  // У продакшені задайте CORS_ORIGIN (кома-розділений список дозволених origin),
  // наприклад: CORS_ORIGIN=https://erp.veles.ua
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : '*';
  app.enableCors({
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`🚀 OKKO ERP Backend Service is running on http://localhost:${port}`);
}
bootstrap();
