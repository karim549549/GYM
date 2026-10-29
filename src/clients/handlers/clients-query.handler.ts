import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import {
  BaseQueryHandler,
  type PaginatedResponse,
} from '../../common/handlers/base-query.handler';
import { clients } from '../../database/schema';
import type { IntakeStatus } from '../enums/intake-status.enum';
import type {
  ClientChanges,
  ClientListFilter,
  ClientRecord,
  NewClient,
} from '../interfaces/client.interface';

const RECORD = {
  id: clients.id,
  fullName: clients.fullName,
  phone: clients.phone,
  intakeStatus: clients.intakeStatus,
  personId: clients.personId,
  createdAt: clients.createdAt,
};

/**
 * Data access for the `clients` table. Row level security keeps it to one workspace, and
 * a client who was removed is only hidden (`deleted_at`), so every read here skips them
 * unless it says otherwise.
 */
@Injectable()
export class ClientsQueryHandler extends BaseQueryHandler {
  list(
    filter: ClientListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<ClientRecord>> {
    const where = and(
      isNull(clients.deletedAt),
      filter.status ? eq(clients.intakeStatus, filter.status) : undefined,
      filter.search ? this.matching(filter.search) : undefined,
    );
    return this.executePageQuery(
      {
        fetchItems: (take, skip) =>
          this.db
            .select(RECORD)
            .from(clients)
            .where(where)
            .orderBy(desc(clients.createdAt), desc(clients.id))
            .limit(take)
            .offset(skip),
        count: async () => {
          const [row] = await this.db
            .select({ total: count() })
            .from(clients)
            .where(where);
          return row.total;
        },
      },
      page,
      limit,
    );
  }

  async findById(id: string): Promise<ClientRecord | null> {
    const rows = await this.db
      .select(RECORD)
      .from(clients)
      .where(and(eq(clients.id, id), isNull(clients.deletedAt)))
      .limit(1);
    return this.firstOrNull(rows);
  }

  /** The one place a removed client is visible: adding the same number again brings them back. */
  async findByPhoneIncludingRemoved(
    phone: string,
  ): Promise<{ id: string; removed: boolean } | null> {
    const rows = await this.db
      .select({ id: clients.id, deletedAt: clients.deletedAt })
      .from(clients)
      .where(eq(clients.phone, phone))
      .limit(1);
    const row = this.firstOrNull(rows);
    return row ? { id: row.id, removed: row.deletedAt !== null } : null;
  }

  async create(
    workspaceId: string,
    client: NewClient,
    personId: string | null,
  ): Promise<ClientRecord> {
    const [created] = await this.db
      .insert(clients)
      .values({ workspaceId, personId, ...client })
      .returning(RECORD);
    return created;
  }

  /** Brings a removed client back with the details given now; how far along they were is kept. */
  async restore(
    id: string,
    details: { fullName: string; personId: string | null },
  ): Promise<ClientRecord> {
    const [restored] = await this.db
      .update(clients)
      .set({ ...details, deletedAt: null })
      .where(eq(clients.id, id))
      .returning(RECORD);
    return restored;
  }

  /** Sets only the fields given. Null when the client is not visible, which includes another workspace's. */
  async update(
    id: string,
    changes: ClientChanges,
  ): Promise<ClientRecord | null> {
    const rows = await this.db
      .update(clients)
      .set({
        ...(changes.fullName !== undefined && { fullName: changes.fullName }),
        ...(changes.phone !== undefined && { phone: changes.phone }),
        ...(changes.personId !== undefined && { personId: changes.personId }),
      })
      .where(and(eq(clients.id, id), isNull(clients.deletedAt)))
      .returning(RECORD);
    return this.firstOrNull(rows);
  }

  /** How many clients the workspace has, not counting the removed: what its plan's limit is measured against. */
  async countActive(): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(clients)
      .where(isNull(clients.deletedAt));
    return row.total;
  }

  /** Returns whether there was a client (not removed) to update. */
  async setIntakeStatus(id: string, status: IntakeStatus): Promise<boolean> {
    const rows = await this.db
      .update(clients)
      .set({ intakeStatus: status })
      .where(and(eq(clients.id, id), isNull(clients.deletedAt)))
      .returning({ id: clients.id });
    return rows.length > 0;
  }

  /** Hides the client. Returns whether there was one to hide. */
  async remove(id: string): Promise<boolean> {
    const rows = await this.db
      .update(clients)
      .set({ deletedAt: new Date() })
      .where(and(eq(clients.id, id), isNull(clients.deletedAt)))
      .returning({ id: clients.id });
    return rows.length > 0;
  }

  /** Part of the name or of the number, with the characters of a pattern taken as plain text. */
  private matching(search: string) {
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    return or(ilike(clients.fullName, pattern), ilike(clients.phone, pattern));
  }
}
