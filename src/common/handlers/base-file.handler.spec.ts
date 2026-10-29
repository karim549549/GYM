import sharp from 'sharp';
import {
  FileStorageUnavailableException,
  InvalidImageException,
} from '../../storage/exceptions/storage-exceptions';
import { StorageBucket } from '../../storage/enums/storage-bucket.enum';
import type { SupabaseStorageClient } from '../../storage/integrations/supabase-storage.client';
import { BaseFileHandler } from './base-file.handler';

class LogoFileHandler extends BaseFileHandler {
  protected readonly bucket: StorageBucket = StorageBucket.PUBLIC;

  save(workspaceId: string, bytes: Uint8Array, contentType: string) {
    return this.putUnprocessedFile(
      this.workspaceKey(workspaceId, 'logo'),
      bytes,
      contentType,
    );
  }

  saveImage(workspaceId: string, bytes: Uint8Array, maxEdgePx = 512) {
    return this.putImage(this.workspaceKey(workspaceId, 'logo'), bytes, {
      maxEdgePx,
    });
  }

  discard(key: string) {
    return this.deleteFile(key);
  }

  publicLinkTo(key: string) {
    return this.createPublicUrl(key);
  }

  linkTo(key: string, seconds?: number) {
    return this.createDownloadUrl(key, seconds);
  }

  keyFor(workspaceId: string, ...parts: string[]) {
    return this.workspaceKey(workspaceId, ...parts);
  }
}

class TinyLimitFileHandler extends LogoFileHandler {
  protected override get maxInputPixels() {
    return 1_000;
  }
}

class PrivatePhotoFileHandler extends LogoFileHandler {
  protected override readonly bucket: StorageBucket = StorageBucket.PHOTOS;
}

function setup(Handler: typeof LogoFileHandler = LogoFileHandler) {
  const storage = {
    upload: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    signedUrl: jest.fn().mockResolvedValue('https://signed.example/x'),
    publicUrl: jest.fn().mockReturnValue('https://public.example/x'),
  };
  const handler = new Handler(storage as unknown as SupabaseStorageClient);
  return { storage, handler };
}

describe('BaseFileHandler', () => {
  it('keeps every workspace file under that workspace', () => {
    const { handler } = setup();

    expect(handler.keyFor('w1', 'logo')).toBe('workspaces/w1/logo');
    expect(handler.keyFor('w1', 'intake', 'form.pdf')).toBe(
      'workspaces/w1/intake/form.pdf',
    );
  });

  it.each([
    ['an empty workspace id', '', ['logo']],
    ['a workspace id with a slash', 'w1/../w2', ['logo']],
    ['no path', 'w1', []],
    ['a parent segment', 'w1', ['..', 'w2']],
    ['an empty segment', 'w1', ['a', '', 'b']],
    ['a segment with a slash', 'w1', ['a/b']],
  ])('refuses a key built from %s', (_label, workspaceId, parts) => {
    const { handler } = setup();

    expect(() => handler.keyFor(workspaceId, ...parts)).toThrow(/storage key/i);
  });

  it('hands bytes to storage as they are', async () => {
    const { storage, handler } = setup();
    const bytes = Buffer.from('png');

    await handler.save('w1', bytes, 'image/png');

    expect(storage.upload).toHaveBeenCalledWith(
      StorageBucket.PUBLIC,
      'workspaces/w1/logo',
      bytes,
      'image/png',
    );
  });

  it('asks storage to delete a key', async () => {
    const { storage, handler } = setup();

    await handler.discard('workspaces/w1/logo');

    expect(storage.remove).toHaveBeenCalledWith(
      StorageBucket.PUBLIC,
      'workspaces/w1/logo',
    );
  });

  describe('public addresses', () => {
    it('are built for a handler whose files live in the public bucket', () => {
      const { storage, handler } = setup();

      expect(handler.publicLinkTo('workspaces/w1/logo.webp')).toBe(
        'https://public.example/x',
      );
      expect(storage.publicUrl).toHaveBeenCalledWith(
        StorageBucket.PUBLIC,
        'workspaces/w1/logo.webp',
      );
    });

    it('are refused for a private bucket, whose files only ever get expiring links', () => {
      const { storage, handler } = setup(PrivatePhotoFileHandler);

      expect(() => handler.publicLinkTo('workspaces/w1/photo.webp')).toThrow(
        /public/i,
      );
      expect(storage.publicUrl).not.toHaveBeenCalled();
    });
  });

  describe('download links', () => {
    it('returns a short-lived link, five minutes unless told otherwise', async () => {
      const { storage, handler } = setup();

      await expect(handler.linkTo('workspaces/w1/logo')).resolves.toBe(
        'https://signed.example/x',
      );
      expect(storage.signedUrl).toHaveBeenCalledWith(
        StorageBucket.PUBLIC,
        'workspaces/w1/logo',
        300,
      );
    });

    it('honours a shorter lifetime', async () => {
      const { storage, handler } = setup();

      await handler.linkTo('k', 60);

      expect(storage.signedUrl).toHaveBeenCalledWith(
        StorageBucket.PUBLIC,
        'k',
        60,
      );
    });

    it('never makes a link that lives longer than an hour', async () => {
      const { storage, handler } = setup();

      await handler.linkTo('k', 86_400);

      expect(storage.signedUrl).toHaveBeenCalledWith(
        StorageBucket.PUBLIC,
        'k',
        3_600,
      );
    });

    it.each([0, -5, 1.5])('refuses a lifetime of %p', async (seconds) => {
      const { storage, handler } = setup();

      await expect(handler.linkTo('k', seconds)).rejects.toThrow(/lifetime/i);
      expect(storage.signedUrl).not.toHaveBeenCalled();
    });
  });

  it('lets a storage failure reach the caller', async () => {
    const { storage, handler } = setup();
    storage.upload.mockRejectedValue(new Error('store down'));

    await expect(
      handler.save('w1', Buffer.from('x'), 'image/png'),
    ).rejects.toThrow('store down');
  });

  describe('putImage', () => {
    const solid = (width: number, height: number) =>
      sharp({
        create: { width, height, channels: 3, background: 'teal' },
      });
    const stored = (storage: { upload: jest.Mock }) => {
      const [bucket, key, body, contentType] = storage.upload.mock.calls[0];
      expect(bucket).toBe(StorageBucket.PUBLIC);
      return {
        key: key as string,
        body: body as Buffer,
        contentType: contentType as string,
      };
    };

    it('stores the image as WebP under the key and says where', async () => {
      const { storage, handler } = setup();

      const key = await handler.saveImage(
        'w1',
        await solid(40, 20).png().toBuffer(),
      );

      expect(key).toBe('workspaces/w1/logo.webp');
      const { key: uploadedKey, body, contentType } = stored(storage);
      expect(uploadedKey).toBe('workspaces/w1/logo.webp');
      expect(contentType).toBe('image/webp');
      expect((await sharp(body).metadata()).format).toBe('webp');
    });

    it('shrinks a large image to the longest edge allowed, keeping its shape', async () => {
      const { storage, handler } = setup();

      await handler.saveImage(
        'w1',
        await solid(2000, 1000).jpeg().toBuffer(),
        500,
      );

      const meta = await sharp(stored(storage).body).metadata();
      expect([meta.width, meta.height]).toEqual([500, 250]);
    });

    it('never enlarges a small image', async () => {
      const { storage, handler } = setup();

      await handler.saveImage('w1', await solid(40, 20).png().toBuffer(), 500);

      const meta = await sharp(stored(storage).body).metadata();
      expect([meta.width, meta.height]).toEqual([40, 20]);
    });

    it('strips the metadata a photo carries, such as where it was taken', async () => {
      const { storage, handler } = setup();
      const withLocation = await solid(40, 20)
        .jpeg()
        .withExif({ IFD0: { ImageDescription: 'GPS-SECRET-LOCATION' } })
        .toBuffer();
      expect(withLocation.includes('GPS-SECRET-LOCATION')).toBe(true);

      await handler.saveImage('w1', withLocation);

      const { body } = stored(storage);
      expect(body.includes('GPS-SECRET-LOCATION')).toBe(false);
      expect((await sharp(body).metadata()).exif).toBeUndefined();
    });

    it('turns a photo upright, then drops the orientation flag', async () => {
      const { storage, handler } = setup();
      const sideways = await solid(40, 20)
        .jpeg()
        .withMetadata({ orientation: 6 })
        .toBuffer();

      await handler.saveImage('w1', sideways);

      const meta = await sharp(stored(storage).body).metadata();
      expect([meta.width, meta.height]).toEqual([20, 40]);
      expect(meta.orientation).toBeUndefined();
    });

    it('destroys anything hidden after the image data', async () => {
      const { storage, handler } = setup();
      const polyglot = Buffer.concat([
        await solid(40, 20).png().toBuffer(),
        Buffer.from('<script>alert(document.cookie)</script>'),
      ]);

      await handler.saveImage('w1', polyglot);

      expect(stored(storage).body.includes('<script>')).toBe(false);
    });

    it.each([
      ['text', Buffer.from('not an image at all')],
      ['an html page', Buffer.from('<html><script>alert(1)</script></html>')],
      [
        'a png header with nothing behind it',
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ],
      ['nothing', Buffer.alloc(0)],
    ])('refuses %s and stores nothing', async (_label, bytes) => {
      const { storage, handler } = setup();

      await expect(handler.saveImage('w1', bytes)).rejects.toBeInstanceOf(
        InvalidImageException,
      );
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('refuses an image with more pixels than allowed, however small the file', async () => {
      const { storage, handler } = setup(TinyLimitFileHandler);
      const tooManyPixels = await solid(100, 100).png().toBuffer();
      expect(tooManyPixels.length).toBeLessThan(2_000);

      await expect(
        handler.saveImage('w1', tooManyPixels),
      ).rejects.toBeInstanceOf(InvalidImageException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('lets a storage failure reach the caller', async () => {
      const { storage, handler } = setup();
      storage.upload.mockRejectedValue(new FileStorageUnavailableException());

      await expect(
        handler.saveImage('w1', await solid(8, 8).png().toBuffer()),
      ).rejects.toBeInstanceOf(FileStorageUnavailableException);
    });
  });
});
