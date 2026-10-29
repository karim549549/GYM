import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp, setupApiDocs } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // Supabase signs its hook calls over the exact bytes of the body
    rawBody: true,
  });
  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService);
  configureApp(app);
  if (config.get('NODE_ENV') !== 'production') {
    setupApiDocs(app);
  }
  app.enableShutdownHooks();
  await app.listen(config.getOrThrow<number>('PORT'));
}
void bootstrap();
