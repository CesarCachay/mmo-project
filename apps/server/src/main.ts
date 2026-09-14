import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const clientOrigin =
    process.env.CLIENT_ORIGIN?.trim() || 'http://localhost:5173';

  app.enableCors({
    origin: clientOrigin,
    credentials: true,
  });

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
