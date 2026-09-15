import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { resolveClientOrigin } from './config/runtime-environment';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const clientOrigin = resolveClientOrigin();

  app.enableCors({
    origin: clientOrigin,
    credentials: true,
  });

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
