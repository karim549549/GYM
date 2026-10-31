import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  Storage,
  StorageFileNotFoundError,
  StorageInvalidKeyError,
  StorageServiceError,
  StorageSignedUrlError,
  serveFile,
  serveSignedUrl,
} from '@nestjs/storage';
import type { Request, Response } from 'express';
import { StorageBucket } from './enums/storage-bucket.enum';
import {
  FileLinkInvalidException,
  FileNotFoundException,
  FileStorageUnavailableException,
  FileTooLargeException,
} from './exceptions/storage-exceptions';

/** Our file API and error codes; @nestjs/storage owns provider I/O and signing. */
@Injectable()
export class StorageService {
  constructor(private readonly storage: Storage) {}

  async upload(
    bucket: StorageBucket,
    key: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<void> {
    await this.run(() =>
      this.storage.disk(bucket).put(key, body, { contentType }),
    );
  }

  async remove(bucket: StorageBucket, key: string): Promise<void> {
    await this.run(() => this.storage.disk(bucket).delete(key));
  }

  signedUrl(
    bucket: StorageBucket,
    key: string,
    seconds: number,
  ): Promise<string> {
    return this.run(async () => {
      const disk = this.storage.disk(bucket);
      // Preserve FILE_NOT_FOUND instead of returning a link to a missing object.
      await disk.stat(key);
      return disk.signedUrl(key, { expiresIn: seconds * 1_000 });
    });
  }

  publicUrl(bucket: StorageBucket, key: string): string {
    return this.storage.disk(bucket).url(key);
  }

  servePublic(key: string, req: Request, res: Response) {
    return this.run(() =>
      serveFile(this.storage.disk(StorageBucket.PUBLIC), key, {
        req,
        res,
        disposition: 'inline',
        cacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  serveSigned(bucket: StorageBucket, req: Request, res: Response) {
    return this.run(() =>
      serveSignedUrl(this.storage.disk(bucket), {
        req,
        res,
        cacheControl: 'private, no-store',
      }),
    );
  }

  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (
        error instanceof StorageFileNotFoundError ||
        error instanceof StorageInvalidKeyError ||
        (error instanceof HttpException &&
          error.getStatus() === HttpStatus.NOT_FOUND)
      ) {
        throw new FileNotFoundException();
      }
      if (
        error instanceof StorageSignedUrlError ||
        (error instanceof HttpException &&
          error.getStatus() === HttpStatus.FORBIDDEN)
      ) {
        throw new FileLinkInvalidException();
      }
      if (
        error instanceof StorageServiceError &&
        error.upstreamStatus === 413
      ) {
        throw new FileTooLargeException();
      }
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE
      ) {
        throw error;
      }
      // Provider errors can contain credentials or internal paths. Keep them internal.
      throw new FileStorageUnavailableException();
    }
  }
}
