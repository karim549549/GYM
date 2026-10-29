import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { Env } from '../config/env.schema';
import { createLoggerParams } from './logger.options';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createLoggerParams({
          nodeEnv: config.get('NODE_ENV', { infer: true }),
          level: config.get('LOG_LEVEL', { infer: true }),
        }),
    }),
  ],
})
export class LoggingModule {}
