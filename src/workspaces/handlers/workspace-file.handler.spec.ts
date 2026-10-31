import sharp from 'sharp';
import { StorageBucket } from '../../storage/enums/storage-bucket.enum';
import { InvalidImageException } from '../../storage/exceptions/storage-exceptions';
import type { StorageService } from '../../storage/storage.service';
import { UnitSystem } from '../enums/unit-system.enum';
import { WorkspaceFileHandler } from './workspace-file.handler';

function setup() {
  const storage = {
    upload: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    publicUrl: jest.fn(
      (bucket: string, key: string) => `https://files.example/${bucket}/${key}`,
    ),
  };
  const handler = new WorkspaceFileHandler(
    storage as unknown as StorageService,
  );
  return { storage, handler };
}

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: 'teal' } })
    .png()
    .toBuffer();

describe('WorkspaceFileHandler', () => {
  describe('saveLogo', () => {
    it('stores the logo as a WebP in the public bucket, under the workspace', async () => {
      const { storage, handler } = setup();

      const key = await handler.saveLogo('w1', await png(100, 100));

      expect(key).toMatch(/^workspaces\/w1\/logo-[0-9a-f]{12}\.webp$/);
      const [bucket, storedKey, , contentType] = storage.upload.mock.calls[0];
      expect(bucket).toBe(StorageBucket.PUBLIC);
      expect(storedKey).toBe(key);
      expect(contentType).toBe('image/webp');
    });

    it('gives every logo a key of its own, so a replaced logo is not hidden by caches', async () => {
      const { handler } = setup();
      const bytes = await png(50, 50);

      const first = await handler.saveLogo('w1', bytes);
      const second = await handler.saveLogo('w1', bytes);

      expect(second).not.toBe(first);
    });

    it('shrinks a large logo so no side is longer than 512 pixels', async () => {
      const { storage, handler } = setup();

      await handler.saveLogo('w1', await png(2000, 1000));

      const meta = await sharp(storage.upload.mock.calls[0][2]).metadata();
      expect([meta.width, meta.height]).toEqual([512, 256]);
    });

    it('refuses what is not an image, and stores nothing', async () => {
      const { storage, handler } = setup();

      await expect(
        handler.saveLogo('w1', Buffer.from('not an image')),
      ).rejects.toBeInstanceOf(InvalidImageException);
      expect(storage.upload).not.toHaveBeenCalled();
    });
  });

  describe('removeLogo', () => {
    it('deletes the logo from the public bucket', async () => {
      const { storage, handler } = setup();

      await handler.removeLogo('workspaces/w1/logo-abc.webp');

      expect(storage.remove).toHaveBeenCalledWith(
        StorageBucket.PUBLIC,
        'workspaces/w1/logo-abc.webp',
      );
    });
  });

  describe('withLogoUrl', () => {
    const row = {
      id: 'w1',
      slug: 'sara-fit',
      brandName: 'Sara Fit',
      logoKey: 'workspaces/w1/logo-abc.webp',
      currency: 'EGP',
      unitSystem: UnitSystem.METRIC,
      expiryAlertDays: 7,
    };

    it('turns the stored key into the address anyone can open', () => {
      const { handler } = setup();

      const details = handler.withLogoUrl(row);

      expect(details.logoUrl).toBe(
        'https://files.example/gym-public/workspaces/w1/logo-abc.webp',
      );
    });

    it('leaves the key out of what it hands on', () => {
      const { handler } = setup();

      expect(handler.withLogoUrl(row)).not.toHaveProperty('logoKey');
    });

    it('says there is no logo when there is no key', () => {
      const { handler } = setup();

      expect(handler.withLogoUrl({ ...row, logoKey: null }).logoUrl).toBeNull();
    });

    it('keeps everything else as it was', () => {
      const { handler } = setup();

      const { logoUrl: _logoUrl, ...rest } = handler.withLogoUrl(row);
      const { logoKey: _logoKey, ...expected } = row;

      expect(rest).toEqual(expected);
    });
  });
});
