import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ZodError } from 'zod';
import { AppModule } from './app.module';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: false }));
  app.useGlobalFilters({
    catch(exception: unknown, host: any) {
      if (exception instanceof ZodError) {
        host.switchToHttp().getResponse().status(400).json({
          statusCode: 400, error: 'ValidationError', details: exception.flatten()
        });
        return;
      }
      throw exception;
    }
  } as any);
  await app.listen(env.PORT);
}
void bootstrap();
