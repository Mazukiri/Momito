import * as dotenv from 'dotenv';
dotenv.config({ override: true });

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { getCorsOrigin } from './common/config';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Without this, NestJS never wires up SIGTERM/SIGINT listeners, so
  // PrismaService.onModuleDestroy (which calls $disconnect) never fires on a
  // platform redeploy/restart — connections just get dropped mid-request.
  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({ origin: getCorsOrigin() });
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(Number(process.env.PORT ?? 3001));
}

void bootstrap();
