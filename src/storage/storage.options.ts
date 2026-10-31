import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { LocalDisk, S3Disk, type StorageModuleOptions } from '@nestjs/storage';
import type { Env } from '../config/env.schema';
import { StorageBucket } from './enums/storage-bucket.enum';

/** Builds storage providers once; file handlers only know their named disk. */
export function createStorageOptions(
  config: ConfigService<Env, true>,
): StorageModuleOptions {
  if (config.get('STORAGE_DRIVER', { infer: true }) === 's3') {
    const common = {
      endpoint: config.get('STORAGE_S3_ENDPOINT', { infer: true }),
      region: config.get('STORAGE_S3_REGION', { infer: true }),
      forcePathStyle: config.get('STORAGE_S3_FORCE_PATH_STYLE', {
        infer: true,
      }),
      credentials: {
        accessKeyId: config.getOrThrow('STORAGE_S3_ACCESS_KEY_ID', {
          infer: true,
        }),
        secretAccessKey: config.getOrThrow('STORAGE_S3_SECRET_ACCESS_KEY', {
          infer: true,
        }),
        sessionToken: config.get('STORAGE_S3_SESSION_TOKEN', { infer: true }),
      },
      timeout: '15s' as const,
      retry: 2,
      // Limit multipart buffers on the 512 MB instance; images normally use one PUT.
      multipart: { concurrency: 1 },
    };
    return {
      default: StorageBucket.FILES,
      disks: {
        [StorageBucket.PUBLIC]: new S3Disk({
          ...common,
          bucket: config.get('STORAGE_S3_PUBLIC_BUCKET', { infer: true }),
          publicUrl: config.getOrThrow('STORAGE_PUBLIC_URL', { infer: true }),
        }),
        [StorageBucket.FILES]: new S3Disk({
          ...common,
          bucket: config.get('STORAGE_S3_FILES_BUCKET', { infer: true }),
        }),
        [StorageBucket.PHOTOS]: new S3Disk({
          ...common,
          bucket: config.get('STORAGE_S3_PHOTOS_BUCKET', { infer: true }),
        }),
      },
    };
  }

  const root = config.get('STORAGE_LOCAL_ROOT', { infer: true });
  const base = config.get('STORAGE_BASE_URL', { infer: true });
  // Development links are invalidated on restart unless a stable key is configured.
  const key =
    config.get('STORAGE_SIGNING_KEY', { infer: true }) ??
    randomBytes(32).toString('hex');
  const disk = (bucket: StorageBucket, route: string, publicUrl?: string) =>
    new LocalDisk({
      root: join(root, bucket),
      publicUrl,
      signedUrls: { baseUrl: `${base}/${route}`, keys: [key] },
    });
  return {
    default: StorageBucket.FILES,
    disks: {
      [StorageBucket.PUBLIC]: disk(
        StorageBucket.PUBLIC,
        'public-download',
        `${base}/public`,
      ),
      [StorageBucket.FILES]: disk(StorageBucket.FILES, 'files'),
      [StorageBucket.PHOTOS]: disk(StorageBucket.PHOTOS, 'photos'),
    },
  };
}
