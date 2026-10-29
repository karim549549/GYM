import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseClient } from '../../common/clients/base.client';
import type { Env } from '../../config/env.schema';
import type { StorageBucket } from '../enums/storage-bucket.enum';
import {
  FileNotFoundException,
  FileStorageUnavailableException,
  FileTooLargeException,
} from '../exceptions/storage-exceptions';

/**
 * The only place that knows Supabase Storage. It deals in keys and bytes and holds no
 * rules about what a file is for. It signs in with the secret key, which bypasses
 * Supabase's own access rules, so every rule about who may see a file is ours (see
 * `BaseFileHandler`). Uploads can be large, so the time limits are longer than the
 * base client's defaults.
 */
@Injectable()
export class SupabaseStorageClient extends BaseClient {
  private readonly storageUrl: string;

  constructor(config: ConfigService<Env, true>) {
    const secretKey = config.get('SUPABASE_SECRET_KEY', { infer: true });
    const storageUrl = `${config.get('SUPABASE_URL', { infer: true })}/storage/v1`;
    super({
      baseUrl: storageUrl,
      headers: { apikey: secretKey, authorization: `Bearer ${secretKey}` },
      timeoutMs: 15_000,
      totalTimeoutMs: 20_000,
    });
    this.storageUrl = storageUrl;
  }

  protected unavailable(): Error {
    return new FileStorageUnavailableException();
  }

  /** Replaces whatever is at the key. */
  async upload(
    bucket: StorageBucket,
    key: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<void> {
    const { status } = await this.send({
      method: 'POST',
      path: `/object/${bucket}/${this.encode(key)}`,
      body,
      headers: { 'content-type': contentType, 'x-upsert': 'true' },
      retry: true, // the same bytes to the same key, so a repeat changes nothing
    });
    if (status === 413) {
      throw new FileTooLargeException();
    }
    this.expectSuccess(status);
  }

  /** A key that is already gone counts as removed. */
  async remove(bucket: StorageBucket, key: string): Promise<void> {
    const { status } = await this.send({
      method: 'DELETE',
      path: `/object/${bucket}`,
      body: { prefixes: [key] },
    });
    this.expectSuccess(status);
  }

  /** A link anyone holding it can read the object with until it expires. */
  async signedUrl(
    bucket: StorageBucket,
    key: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const { status, body } = await this.send({
      method: 'POST',
      path: `/object/sign/${bucket}/${this.encode(key)}`,
      body: { expiresIn: expiresInSeconds },
      retry: true, // signing changes nothing
    });
    // a missing object is answered with a 400 that carries 404 in its body
    if (status === 404 || body?.statusCode === '404') {
      throw new FileNotFoundException();
    }
    this.expectSuccess(status);

    const signed: unknown = body?.signedURL;
    if (typeof signed !== 'string' || !signed.startsWith('/object/sign/')) {
      throw new FileStorageUnavailableException();
    }
    return `${this.storageUrl}${signed}`;
  }

  /** The address anyone can open a file of a public bucket at. Builds a string; makes no call. */
  publicUrl(bucket: StorageBucket, key: string): string {
    return `${this.storageUrl}/object/public/${bucket}/${this.encode(key)}`;
  }

  private expectSuccess(status: number): void {
    if (status < 200 || status >= 300) {
      throw new FileStorageUnavailableException();
    }
  }

  private encode(key: string): string {
    return key.split('/').map(encodeURIComponent).join('/');
  }
}
