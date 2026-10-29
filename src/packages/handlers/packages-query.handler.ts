import { Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { BaseQueryHandler } from '../../common/handlers/base-query.handler';
import { packages } from '../../database/schema';
import type {
  NewPackage,
  PackageChanges,
  PackageRecord,
} from '../interfaces/package.interface';

const RECORD = {
  id: packages.id,
  name: packages.name,
  durationDays: packages.durationDays,
  priceMinor: packages.priceMinor,
  currency: packages.currency,
  isActive: packages.isActive,
};

/** Data access for the `packages` table. Row level security keeps it to one workspace. */
@Injectable()
export class PackagesQueryHandler extends BaseQueryHandler {
  /** Shortest first. A coach has a handful, so this is a plain list, not a paginated one. */
  list(includeInactive: boolean): Promise<PackageRecord[]> {
    return this.db
      .select(RECORD)
      .from(packages)
      .where(includeInactive ? undefined : eq(packages.isActive, true))
      .orderBy(asc(packages.durationDays), asc(packages.createdAt));
  }

  async findById(id: string): Promise<PackageRecord | null> {
    const rows = await this.db
      .select(RECORD)
      .from(packages)
      .where(eq(packages.id, id))
      .limit(1);
    return this.firstOrNull(rows);
  }

  async create(
    workspaceId: string,
    pkg: NewPackage,
    currency: string,
  ): Promise<PackageRecord> {
    const [created] = await this.db
      .insert(packages)
      .values({ workspaceId, currency, ...pkg })
      .returning(RECORD);
    return created;
  }

  async createMany(
    workspaceId: string,
    list: NewPackage[],
    currency: string,
  ): Promise<void> {
    if (list.length === 0) {
      return;
    }
    await this.db
      .insert(packages)
      .values(list.map((pkg) => ({ workspaceId, currency, ...pkg })));
  }

  /** Sets only the fields given. Null when the package is not visible, which includes another workspace's. */
  async update(
    id: string,
    changes: PackageChanges,
  ): Promise<PackageRecord | null> {
    const rows = await this.db
      .update(packages)
      .set({
        ...(changes.name !== undefined && { name: changes.name }),
        ...(changes.durationDays !== undefined && {
          durationDays: changes.durationDays,
        }),
        ...(changes.priceMinor !== undefined && {
          priceMinor: changes.priceMinor,
        }),
        ...(changes.isActive !== undefined && { isActive: changes.isActive }),
      })
      .where(and(eq(packages.id, id)))
      .returning(RECORD);
    return this.firstOrNull(rows);
  }
}
