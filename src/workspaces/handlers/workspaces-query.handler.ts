import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { BaseQueryHandler } from '../../common/handlers/base-query.handler';
import { workspaces } from '../../database/schema';
import type {
  CreatedWorkspace,
  WorkspaceChanges,
  WorkspaceRow,
} from '../interfaces/workspace.interface';

const ROW = {
  id: workspaces.id,
  slug: workspaces.slug,
  brandName: workspaces.brandName,
  logoKey: workspaces.logoKey,
  currency: workspaces.currency,
  unitSystem: workspaces.unitSystem,
  expiryAlertDays: workspaces.expiryAlertDays,
};

/** Data access for the `workspaces` table (the tenant). */
@Injectable()
export class WorkspacesQueryHandler extends BaseQueryHandler {
  /** The database chooses the id, and the new workspace becomes the scope of the open transaction. */
  async create(workspace: {
    brandName: string;
    slug: string;
  }): Promise<Pick<CreatedWorkspace, 'id' | 'slug' | 'currency'>> {
    const [created] = await this.db
      .insert(workspaces)
      .values(workspace)
      .returning({
        id: workspaces.id,
        slug: workspaces.slug,
        currency: workspaces.currency,
      });
    return created;
  }

  async findById(id: string): Promise<WorkspaceRow | null> {
    const rows = await this.db
      .select(ROW)
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1);
    return this.firstOrNull(rows);
  }

  /** Sets only the fields given. Returns the workspace as it now is, or null if it is not visible. */
  async update(
    id: string,
    changes: WorkspaceChanges,
  ): Promise<WorkspaceRow | null> {
    const rows = await this.db
      .update(workspaces)
      .set({
        ...(changes.brandName !== undefined && {
          brandName: changes.brandName,
        }),
        ...(changes.currency !== undefined && { currency: changes.currency }),
        ...(changes.unitSystem !== undefined && {
          unitSystem: changes.unitSystem,
        }),
        ...(changes.expiryAlertDays !== undefined && {
          expiryAlertDays: changes.expiryAlertDays,
        }),
      })
      .where(eq(workspaces.id, id))
      .returning(ROW);
    return this.firstOrNull(rows);
  }

  /** Records where the logo is in storage, or clears it. */
  async setLogoKey(id: string, logoKey: string | null): Promise<void> {
    await this.db
      .update(workspaces)
      .set({ logoKey })
      .where(eq(workspaces.id, id));
  }
}
