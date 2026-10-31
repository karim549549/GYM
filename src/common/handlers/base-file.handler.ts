import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { InvalidImageException } from '../../storage/exceptions/storage-exceptions';
import { StorageBucket } from '../../storage/enums/storage-bucket.enum';
import { StorageService } from '../../storage/storage.service';

/**
 * Base of every file handler: all file operations, and nothing else. A module's file
 * handler extends it and says what its files are (a logo, an intake document); this
 * base owns how a file is stored, so changing the store touches `storage/` and this
 * file only.
 *
 * Images are never stored as they arrive: `putImage` decodes and re-encodes them, which
 * removes anything hidden in the file and the metadata a photo carries (where it was
 * taken). Storing bytes untouched is a separate, deliberately awkward method.
 *
 * The object store has no row level security, so tenancy is in the key: a workspace's
 * files live under `workspaces/<id>/`, and `workspaceKey` is the only way to build one.
 */
@Injectable()
export abstract class BaseFileHandler {
  protected static readonly DEFAULT_LINK_SECONDS = 300;
  protected static readonly MAX_LINK_SECONDS = 3_600;
  private static readonly IMAGE_QUALITY = 85;

  /** The bucket this handler's files live in. A handler uses exactly one. */
  protected abstract readonly bucket: StorageBucket;

  constructor(private readonly storage: StorageService) {}

  /** A small file can still unpack to billions of pixels and exhaust memory; 50 megapixels covers any phone camera. */
  protected get maxInputPixels(): number {
    return 50_000_000;
  }

  /**
   * Decodes the image and stores a fresh WebP, no longer than `maxEdgePx` on its longest
   * side and never enlarged. The stored key is the one given plus `.webp`, and is
   * returned. Anything that does not decode as an image is refused.
   */
  protected async putImage(
    key: string,
    bytes: Uint8Array,
    options: { maxEdgePx: number },
  ): Promise<string> {
    if (!Number.isInteger(options.maxEdgePx) || options.maxEdgePx < 1) {
      throw new Error('maxEdgePx must be a positive whole number');
    }

    let clean: Buffer;
    try {
      clean = await sharp(bytes, {
        limitInputPixels: this.maxInputPixels,
        failOn: 'error',
      })
        .rotate() // applies the orientation flag, which the output then no longer needs
        .resize({
          width: options.maxEdgePx,
          height: options.maxEdgePx,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: BaseFileHandler.IMAGE_QUALITY })
        .toBuffer();
    } catch {
      throw new InvalidImageException();
    }

    const storedKey = `${key}.webp`;
    await this.storage.upload(this.bucket, storedKey, clean, 'image/webp');
    return storedKey;
  }

  /**
   * Stores bytes exactly as they are. Not for images (use `putImage`). A file kind that
   * needs this has a written rule first (see "Files" in AGENTS.md).
   */
  protected putUnprocessedFile(
    key: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<void> {
    return this.storage.upload(this.bucket, key, body, contentType);
  }

  protected deleteFile(key: string): Promise<void> {
    return this.storage.remove(this.bucket, key);
  }

  /** A link that expires, never one that lasts: files stay private and are shown through these. */
  protected async createDownloadUrl(
    key: string,
    lifetimeSeconds: number = BaseFileHandler.DEFAULT_LINK_SECONDS,
  ): Promise<string> {
    if (!Number.isInteger(lifetimeSeconds) || lifetimeSeconds < 1) {
      throw new Error(
        'A download link lifetime must be a whole number of seconds',
      );
    }
    return this.storage.signedUrl(
      this.bucket,
      key,
      Math.min(lifetimeSeconds, BaseFileHandler.MAX_LINK_SECONDS),
    );
  }

  /** For files meant to be seen by anyone with the link, such as a logo. Only the public bucket has these. */
  protected createPublicUrl(key: string): string {
    if (this.bucket !== StorageBucket.PUBLIC) {
      throw new Error('Only the public bucket has public addresses');
    }
    return this.storage.publicUrl(this.bucket, key);
  }

  protected workspaceKey(workspaceId: string, ...path: string[]): string {
    const segments = [workspaceId, ...path];
    if (
      path.length === 0 ||
      !segments.every((segment) => BaseFileHandler.isSafeSegment(segment))
    ) {
      throw new Error('Invalid storage key');
    }
    return ['workspaces', ...segments].join('/');
  }

  private static isSafeSegment(segment: string): boolean {
    return (
      segment !== '' &&
      segment !== '.' &&
      segment !== '..' &&
      !segment.includes('/')
    );
  }
}
