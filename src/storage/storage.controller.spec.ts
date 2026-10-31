import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { STORAGE_MODULE_OPTIONS } from '@nestjs/storage';
import request from 'supertest';
import { configureApp } from '../app.setup';
import { validateEnv } from '../config/env.schema';
import { StorageBucket } from './enums/storage-bucket.enum';
import { StorageModule } from './storage.module';
import { createStorageOptions } from './storage.options';
import { StorageService } from './storage.service';

describe('Local file storage over HTTP', () => {
  let app: INestApplication;
  let storage: StorageService;
  let root: string;
  const body = Buffer.from('stored file bytes');

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'gym-storage-test-'));
    const options = createStorageOptions(
      new ConfigService(
        validateEnv({
          DATABASE_URL: 'postgres://test:test@localhost/test',
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_PUBLISHABLE_KEY: 'test',
          STORAGE_LOCAL_ROOT: root,
          STORAGE_BASE_URL: 'http://localhost/api/v1/storage',
          STORAGE_SIGNING_KEY: 'storage-test-key-at-least-32-characters',
        }),
      ),
    );
    const module = await Test.createTestingModule({ imports: [StorageModule] })
      .overrideProvider(STORAGE_MODULE_OPTIONS)
      .useValue(options)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    storage = app.get(StorageService);
    await Promise.all(
      Object.values(StorageBucket).map((bucket) =>
        storage.upload(bucket, 'workspaces/w1/image.webp', body, 'image/webp'),
      ),
    );
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app?.close();
    if (
      root &&
      dirname(resolve(root)) === resolve(tmpdir()) &&
      root.includes('gym-storage-test-')
    ) {
      await rm(root, { recursive: true, force: true });
    }
  });

  const pathOf = (url: string) => {
    const value = new URL(url);
    return value.pathname + value.search;
  };

  it('serves a public file with safe headers, ETag and byte ranges', async () => {
    const path = pathOf(
      storage.publicUrl(StorageBucket.PUBLIC, 'workspaces/w1/image.webp'),
    );
    const response = await request(app.getHttpServer()).get(path).expect(200);
    expect(response.body).toEqual(body);
    expect(response.headers['content-type']).toContain('image/webp');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-disposition']).toMatch(/^inline/);
    const partial = await request(app.getHttpServer())
      .get(path)
      .set('Range', 'bytes=0-5')
      .expect(206);
    expect(partial.body).toEqual(body.subarray(0, 6));
    await request(app.getHttpServer())
      .get(path)
      .set('If-None-Match', response.headers.etag)
      .expect(304);
  });

  it('does not expose private files or photos through an unsigned route', async () => {
    const results = await Promise.all(
      ['files', 'photos'].map((route) =>
        request(app.getHttpServer())
          .get(`/api/v1/storage/${route}?key=workspaces/w1/image.webp`)
          .expect(403),
      ),
    );
    expect(results.map((result) => result.body.code)).toEqual([
      'FILE_LINK_INVALID',
      'FILE_LINK_INVALID',
    ]);
  });

  it('serves a private file only with its signed URL and does not cache it', async () => {
    const url = await storage.signedUrl(
      StorageBucket.FILES,
      'workspaces/w1/image.webp',
      60,
    );
    const response = await request(app.getHttpServer())
      .get(pathOf(url))
      .expect(200);
    expect(response.body).toEqual(body);
    expect(response.headers['cache-control']).toBe('private, no-store');
  });

  it('rejects changing the key or reusing a file signature on the photos route', async () => {
    const url = new URL(
      await storage.signedUrl(
        StorageBucket.FILES,
        'workspaces/w1/image.webp',
        60,
      ),
    );
    const changed = new URL(url);
    changed.searchParams.set('key', 'workspaces/w2/image.webp');
    await request(app.getHttpServer()).get(pathOf(changed.href)).expect(403);
    url.pathname = '/api/v1/storage/photos';
    await request(app.getHttpServer()).get(pathOf(url.href)).expect(403);
  });

  it('rejects expired signed URLs', async () => {
    const url = await storage.signedUrl(
      StorageBucket.FILES,
      'workspaces/w1/image.webp',
      1,
    );
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 5_000);
    try {
      await request(app.getHttpServer()).get(pathOf(url)).expect(403);
    } finally {
      clock.mockRestore();
    }
  });

  it('returns our FILE_NOT_FOUND code without exposing filesystem paths', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/storage/public/not-here.webp')
      .expect(404);
    expect(response.body.code).toBe('FILE_NOT_FOUND');
    expect(JSON.stringify(response.body)).not.toContain(root);
  });
});
