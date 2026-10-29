import { Module } from '@nestjs/common';
import { SupabaseStorageClient } from './integrations/supabase-storage.client';

/** File storage. Only file handlers (`BaseFileHandler`) use it. */
@Module({
  providers: [SupabaseStorageClient],
  exports: [SupabaseStorageClient],
})
export class StorageModule {}
