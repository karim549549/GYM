import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { BaseFileHandler } from '../../common/handlers/base-file.handler';
import { StorageBucket } from '../../storage/enums/storage-bucket.enum';

/**
 * The transfer screenshots kept with a payment. They show a bank or wallet account, so they live in
 * the private bucket and are only shown through links that expire.
 */
@Injectable()
export class PaymentFileHandler extends BaseFileHandler {
  private static readonly RECEIPT_MAX_EDGE_PX = 1600;
  private static readonly LINK_SECONDS = 3_600;

  protected readonly bucket: StorageBucket = StorageBucket.FILES;

  /** Stores the screenshot as a fresh WebP and returns its key. Every one gets a key of its own. */
  saveReceipt(workspaceId: string, bytes: Uint8Array): Promise<string> {
    const key = this.workspaceKey(
      workspaceId,
      'receipts',
      `payment-${randomBytes(8).toString('hex')}`,
    );
    return this.putImage(key, bytes, {
      maxEdgePx: PaymentFileHandler.RECEIPT_MAX_EDGE_PX,
    });
  }

  removeReceipt(key: string): Promise<void> {
    return this.deleteFile(key);
  }

  receiptUrlOf(key: string | null): Promise<string | null> {
    return key
      ? this.createDownloadUrl(key, PaymentFileHandler.LINK_SECONDS)
      : Promise.resolve(null);
  }
}
