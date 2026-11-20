import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { ZodError } from 'zod';
import { AppModule } from './app.module';
import { env } from './config/env';
import { configureHttpHardening } from './ops/hardening';

@Catch(ZodError)
class ZodValidationFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost) {
    host.switchToHttp().getResponse().status(400).json({
      statusCode: 400, error: 'ValidationError', details: exception.flatten()
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureHttpHardening(app);
  app.enableShutdownHooks();
  app.useGlobalFilters(new ZodValidationFilter());
  await app.listen(env.PORT);
}
void bootstrap();
