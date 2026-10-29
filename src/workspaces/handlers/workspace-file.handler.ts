import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { BaseFileHandler } from '../../common/handlers/base-file.handler';
import { StorageBucket } from '../../storage/enums/storage-bucket.enum';
import type {
  WorkspaceDetails,
  WorkspaceRow,
} from '../interfaces/workspace.interface';

/**
 * The files of a workspace. For now that is its logo, which clients see on their intake
 * link, so it lives in the public bucket.
 */
@Injectable()
export class WorkspaceFileHandler extends BaseFileHandler {
  private static readonly LOGO_MAX_EDGE_PX = 512;

  protected readonly bucket: StorageBucket = StorageBucket.PUBLIC;

  /**
   * Stores the logo as a fresh WebP and returns its key. Every logo gets a key of its own,
   * so a replaced logo is not hidden behind a cached copy of the old one. The random part
   * only names a file; it is not an id of ours.
   */
  saveLogo(workspaceId: string, bytes: Uint8Array): Promise<string> {
    const key = this.workspaceKey(
      workspaceId,
      `logo-${randomBytes(6).toString('hex')}`,
    );
    return this.putImage(key, bytes, {
      maxEdgePx: WorkspaceFileHandler.LOGO_MAX_EDGE_PX,
    });
  }

  removeLogo(key: string): Promise<void> {
    return this.deleteFile(key);
  }

  logoUrlOf(key: string): string {
    return this.createPublicUrl(key);
  }

  /** The workspace as a coach sees it: the stored key becomes the address of the logo. */
  withLogoUrl(row: WorkspaceRow): WorkspaceDetails {
    const { logoKey, ...rest } = row;
    return { ...rest, logoUrl: logoKey ? this.logoUrlOf(logoKey) : null };
  }
}
