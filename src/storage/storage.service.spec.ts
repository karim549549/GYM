import { InMemoryDisk, Storage, StorageServiceError } from '@nestjs/storage';
import { StorageBucket } from './enums/storage-bucket.enum';
import {
  FileNotFoundException,
  FileStorageUnavailableException,
  FileTooLargeException,
} from './exceptions/storage-exceptions';
import { StorageService } from './storage.service';

function setup() {
  const publicDisk = new InMemoryDisk({
    publicUrl: 'https://files.example/public',
  });
  const privateDisk = new InMemoryDisk({
    signedUrls: {
      baseUrl: 'https://api.example/files',
      keys: ['storage-test-signing-key-at-least-32-characters'],
    },
  });
  const storage = new Storage(
    new Map([
      [StorageBucket.PUBLIC, publicDisk],
      [StorageBucket.FILES, privateDisk],
      [StorageBucket.PHOTOS, new InMemoryDisk()],
    ]),
    StorageBucket.FILES,
  );
  return { service: new StorageService(storage), publicDisk, privateDisk };
}

describe('StorageService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('stores bytes and metadata in the selected disk without mixing private and public files', async () => {
    const { service, publicDisk, privateDisk } = setup();
    await service.upload(
      StorageBucket.FILES,
      'workspaces/w1/file.webp',
      Buffer.from('private'),
      'image/webp',
    );
    expect(await privateDisk.getText('workspaces/w1/file.webp')).toBe(
      'private',
    );
    expect(
      (await privateDisk.stat('workspaces/w1/file.webp')).contentType,
    ).toBe('image/webp');
    expect(publicDisk.keys()).toEqual([]);
    await service.remove(StorageBucket.FILES, 'workspaces/w1/file.webp');
    await service.remove(StorageBucket.FILES, 'workspaces/w1/file.webp');
    expect(privateDisk.keys()).toEqual([]);
  });

  it('builds public URLs but keeps private disks without public addresses', () => {
    const { service } = setup();
    expect(
      service.publicUrl(StorageBucket.PUBLIC, 'workspaces/w1/logo.webp'),
    ).toBe('https://files.example/public/workspaces/w1/logo.webp');
    expect(() =>
      service.publicUrl(StorageBucket.FILES, 'private.webp'),
    ).toThrow();
  });

  it('converts our seconds to the library milliseconds and produces a verifiable private link', async () => {
    const { service, privateDisk } = setup();
    await privateDisk.put('private.webp', Buffer.from('private'), {
      contentType: 'image/webp',
    });
    const now = Date.now();
    const url = await service.signedUrl(
      StorageBucket.FILES,
      'private.webp',
      60,
    );
    const claims = privateDisk.verifySignedUrl(url);
    expect(claims.key).toBe('private.webp');
    expect(claims.expiresAt.getTime() - now).toBeGreaterThan(58_000);
    expect(claims.expiresAt.getTime() - now).toBeLessThanOrEqual(60_000);
  });

  it('refuses to issue a signed URL for a missing object', async () => {
    const { service } = setup();
    await expect(
      service.signedUrl(StorageBucket.FILES, 'missing.webp', 60),
    ).rejects.toBeInstanceOf(FileNotFoundException);
  });

  it('maps a missing key to our stable error code', async () => {
    const { service } = setup();
    // Local serving tests exercise the HTTP variant of this mapping as well.
    await expect(
      service.upload(
        StorageBucket.FILES,
        '../invalid',
        Buffer.from('x'),
        'text/plain',
      ),
    ).rejects.toBeInstanceOf(FileNotFoundException);
  });

  it('hides provider replies and credentials when storage fails', async () => {
    const { service, privateDisk } = setup();
    jest.spyOn(privateDisk, 'put').mockRejectedValue(
      new StorageServiceError({
        operation: 'put',
        code: 'AccessDenied',
        upstreamStatus: 403,
        message: 'provider-secret-credential',
      }),
    );
    const error: unknown = await service
      .upload(StorageBucket.FILES, 'file.webp', Buffer.from('x'), 'image/webp')
      .catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(FileStorageUnavailableException);
    expect(JSON.stringify(error)).not.toContain('provider-secret-credential');
  });

  it('maps an upstream object-size limit to PAYLOAD_TOO_LARGE', async () => {
    const { service, privateDisk } = setup();
    jest.spyOn(privateDisk, 'put').mockRejectedValue(
      new StorageServiceError({
        operation: 'put',
        code: 'EntityTooLarge',
        upstreamStatus: 413,
      }),
    );
    await expect(
      service.upload(
        StorageBucket.FILES,
        'file.webp',
        Buffer.from('x'),
        'image/webp',
      ),
    ).rejects.toBeInstanceOf(FileTooLargeException);
  });
});
