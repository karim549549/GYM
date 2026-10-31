import { ConfigService } from '@nestjs/config';
import { S3Disk } from '@nestjs/storage';
import { validateEnv } from '../config/env.schema';
import { StorageBucket } from './enums/storage-bucket.enum';
import { createStorageOptions } from './storage.options';

describe('S3 storage configuration', () => {
  it('configures separate public, private and photo disks with native presigned URLs', async () => {
    const options = createStorageOptions(
      new ConfigService(
        validateEnv({
          DATABASE_URL: 'postgres://test:test@localhost/test',
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_PUBLISHABLE_KEY: 'test',
          STORAGE_DRIVER: 's3',
          STORAGE_S3_ENDPOINT: 'https://objects.example.com',
          STORAGE_S3_REGION: 'auto',
          STORAGE_S3_FORCE_PATH_STYLE: 'true',
          STORAGE_S3_ACCESS_KEY_ID: 'test-access-key',
          STORAGE_S3_SECRET_ACCESS_KEY: 'test-secret-key',
          STORAGE_PUBLIC_URL: 'https://cdn.example.com',
        }),
      ),
    );
    expect(options.default).toBe(StorageBucket.FILES);
    const disks = options.disks!;
    expect(Object.values(disks).every((disk) => disk instanceof S3Disk)).toBe(
      true,
    );
    expect(disks[StorageBucket.PUBLIC].url('workspaces/w1/logo.webp')).toBe(
      'https://cdn.example.com/workspaces/w1/logo.webp',
    );
    expect(() =>
      disks[StorageBucket.PHOTOS].url('workspaces/w1/image.webp'),
    ).toThrow();
    const url = new URL(
      await disks[StorageBucket.PHOTOS].signedUrl('workspaces/w1/image.webp', {
        expiresIn: '5m',
      }),
    );
    expect(url.origin).toBe('https://objects.example.com');
    expect(url.pathname).toBe('/gym-photos/workspaces/w1/image.webp');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.has('X-Amz-Signature')).toBe(true);
    expect(url.href).not.toContain('test-secret-key');
  });
});
