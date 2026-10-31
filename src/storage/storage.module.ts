import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageModule as NestStorageModule } from '@nestjs/storage';
import { StorageController } from './storage.controller';
import { createStorageOptions } from './storage.options';
import { StorageService } from './storage.service';

/** File storage. Only file handlers (`BaseFileHandler`) use it. */
@Module({
  imports: [
    NestStorageModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createStorageOptions,
      isGlobal: false,
    }),
  ],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
