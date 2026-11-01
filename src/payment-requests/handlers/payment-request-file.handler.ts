import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { BaseFileHandler } from '../../common/handlers/base-file.handler';
import { StorageBucket } from '../../storage/enums/storage-bucket.enum';

/**
 * The transfer screenshots clients send through a payment link. They show a bank or wallet
 * account, so they live in the private bucket and are only shown through links that expire.
 */
@Injectable()
export class PaymentRequestFileHandler extends BaseFileHandler {
  private static readonly RECEIPT_MAX_EDGE_PX = 1600;
  private static readonly LINK_SECONDS = 3_600;

  protected readonly bucket: StorageBucket = StorageBucket.FILES;

  /** Stores the screenshot as a fresh WebP and returns its key. The random part only names a file. */
  saveReceipt(workspaceId: string, bytes: Uint8Array): Promise<string> {
    const key = this.workspaceKey(
      workspaceId,
      'receipts',
      `link-${randomBytes(8).toString('hex')}`,
    );
    return this.putImage(key, bytes, {
      maxEdgePx: PaymentRequestFileHandler.RECEIPT_MAX_EDGE_PX,
    });
  }

  removeReceipt(key: string): Promise<void> {
    return this.deleteFile(key);
  }

  receiptUrlOf(key: string | null): Promise<string | null> {
    return key
      ? this.createDownloadUrl(key, PaymentRequestFileHandler.LINK_SECONDS)
      : Promise.resolve(null);
  }
}
