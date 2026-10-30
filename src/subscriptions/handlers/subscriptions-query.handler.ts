import { Injectable } from '@nestjs/common';
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  min,
  ne,
  sql,
} from 'drizzle-orm';
import {
  BaseQueryHandler,
  type PaginatedResponse,
} from '../../common/handlers/base-query.handler';
import { subscriptionFreezes, subscriptions } from '../../database/schema';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import type {
  FreezeRecord,
  NewSubscription,
  StoredSubscription,
  StoredSubscriptionFilter,
} from '../interfaces/subscription.interface';

const RECORD = {
  id: subscriptions.id,
  clientId: subscriptions.clientId,
  packageId: subscriptions.packageId,
  packageName: subscriptions.packageName,
  priceMinor: subscriptions.priceMinor,
  currency: subscriptions.currency,
  startsOn: subscriptions.startsOn,
  endsOn: subscriptions.endsOn,
  status: subscriptions.status,
  createdAt: subscriptions.createdAt,
};

const FREEZE = {
  id: subscriptionFreezes.id,
  frozenOn: subscriptionFreezes.frozenOn,
  resumedOn: subscriptionFreezes.resumedOn,
  reason: subscriptionFreezes.reason,
};

const LIVE = [SubscriptionStatus.ACTIVE, SubscriptionStatus.FROZEN];

/** Data access for `subscriptions` and `subscription_freezes`. Row level security keeps it to one workspace. */
@Injectable()
export class SubscriptionsQueryHandler extends BaseQueryHandler {
  async create(
    workspaceId: string,
    subscription: NewSubscription,
  ): Promise<StoredSubscription> {
    const [created] = await this.db
      .insert(subscriptions)
      .values({ workspaceId, ...subscription })
      .returning(RECORD);
    return created;
  }

  async findById(id: string): Promise<StoredSubscription | null> {
    const rows = await this.db
      .select(RECORD)
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);
    return this.firstOrNull(rows);
  }

  /** Locks the row until the transaction ends, so two changes to one subscription take turns. */
  async lockById(id: string): Promise<StoredSubscription | null> {
    const rows = await this.db
      .select(RECORD)
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1)
      .for('update');
    return this.firstOrNull(rows);
  }

  /** The client's running or frozen subscription, locked. */
  async lockLiveForClient(
    clientId: string,
  ): Promise<StoredSubscription | null> {
    const rows = await this.db
      .select(RECORD)
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.clientId, clientId),
          inArray(subscriptions.status, LIVE),
        ),
      )
      .limit(1)
      .for('update');
    return this.firstOrNull(rows);
  }

  /** The running subscription (active or frozen) of each of these clients; there is at most one each. */
  findLiveByClientIds(clientIds: string[]): Promise<StoredSubscription[]> {
    if (clientIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.db
      .select(RECORD)
      .from(subscriptions)
      .where(
        and(
          inArray(subscriptions.clientId, clientIds),
          inArray(subscriptions.status, LIVE),
        ),
      );
  }

  list(
    filter: StoredSubscriptionFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<StoredSubscription>> {
    const where = and(
      filter.clientId ? eq(subscriptions.clientId, filter.clientId) : undefined,
      filter.status ? eq(subscriptions.status, filter.status) : undefined,
      filter.endsFrom ? gte(subscriptions.endsOn, filter.endsFrom) : undefined,
      filter.endsTo ? lte(subscriptions.endsOn, filter.endsTo) : undefined,
    );
    return this.executePageQuery(
      {
        fetchItems: (take, skip) =>
          this.db
            .select(RECORD)
            .from(subscriptions)
            .where(where)
            .orderBy(
              desc(subscriptions.startsOn),
              desc(subscriptions.createdAt),
              desc(subscriptions.id),
            )
            .limit(take)
            .offset(skip),
        count: async () => {
          const [row] = await this.db
            .select({ total: count() })
            .from(subscriptions)
            .where(where);
          return row.total;
        },
      },
      page,
      limit,
    );
  }

  async setStatus(id: string, status: SubscriptionStatus): Promise<void> {
    await this.db
      .update(subscriptions)
      .set({ status })
      .where(eq(subscriptions.id, id));
  }

  async setEndsOn(id: string, endsOn: string): Promise<void> {
    await this.db
      .update(subscriptions)
      .set({ endsOn })
      .where(eq(subscriptions.id, id));
  }

  /** Resuming: the status and the later end date change together. */
  async resume(id: string, endsOn: string): Promise<void> {
    await this.db
      .update(subscriptions)
      .set({ status: SubscriptionStatus.ACTIVE, endsOn })
      .where(eq(subscriptions.id, id));
  }

  async openFreeze(
    subscriptionId: string,
  ): Promise<{ id: string; frozenOn: string } | null> {
    const rows = await this.db
      .select({
        id: subscriptionFreezes.id,
        frozenOn: subscriptionFreezes.frozenOn,
      })
      .from(subscriptionFreezes)
      .where(
        and(
          eq(subscriptionFreezes.subscriptionId, subscriptionId),
          isNull(subscriptionFreezes.resumedOn),
        ),
      )
      .limit(1);
    return this.firstOrNull(rows);
  }

  async createFreeze(
    workspaceId: string,
    subscriptionId: string,
    frozenOn: string,
    reason: string | null,
  ): Promise<void> {
    await this.db
      .insert(subscriptionFreezes)
      .values({ workspaceId, subscriptionId, frozenOn, reason });
  }

  async closeFreeze(id: string, resumedOn: string): Promise<void> {
    await this.db
      .update(subscriptionFreezes)
      .set({ resumedOn })
      .where(eq(subscriptionFreezes.id, id));
  }

  listFreezes(
    subscriptionId: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<FreezeRecord>> {
    const where = eq(subscriptionFreezes.subscriptionId, subscriptionId);
    return this.executePageQuery(
      {
        fetchItems: (take, skip) =>
          this.db
            .select(FREEZE)
            .from(subscriptionFreezes)
            .where(where)
            .orderBy(
              desc(subscriptionFreezes.frozenOn),
              desc(subscriptionFreezes.createdAt),
            )
            .limit(take)
            .offset(skip),
        count: async () => {
          const [row] = await this.db
            .select({ total: count() })
            .from(subscriptionFreezes)
            .where(where);
          return row.total;
        },
      },
      page,
      limit,
    );
  }

  /** Clients with a subscription (not cancelled) that covers this day. */
  async countClientsCoveredOn(day: string): Promise<number> {
    const [row] = await this.db
      .select({ total: countDistinct(subscriptions.clientId) })
      .from(subscriptions)
      .where(
        and(
          ne(subscriptions.status, SubscriptionStatus.CANCELLED),
          lte(subscriptions.startsOn, day),
          gte(subscriptions.endsOn, day),
        ),
      );
    return row.total;
  }

  /**
   * Of the subscriptions (not cancelled) that ended in a window, how many the client followed with
   * another that began within `graceDays` of the end: the renewals.
   */
  async renewalStats(
    from: string,
    to: string,
    graceDays: number,
  ): Promise<{ ended: number; renewed: number }> {
    const result = await this.db.execute<{
      ended: string;
      renewed: string;
    }>(sql`
      select
        count(*) as ended,
        count(*) filter (where exists (
          select 1 from subscriptions next
          where next.client_id = s.client_id
            and next.status <> 'cancelled'
            and next.starts_on > s.starts_on
            and next.starts_on <= s.ends_on + ${graceDays}::int
        )) as renewed
      from subscriptions s
      where s.status <> 'cancelled'
        and s.ends_on between ${from}::date and ${to}::date
    `);
    const [row] = result.rows;
    return { ended: Number(row.ended), renewed: Number(row.renewed) };
  }

  /**
   * How long clients stay: each client's days from their first subscription to the end of their
   * last (cut at `today`, so one still running counts only what has happened).
   */
  async lifetimeStats(
    today: string,
  ): Promise<{ clients: number; totalDays: number }> {
    const result = await this.db.execute<{ clients: string; days: string }>(sql`
      select count(*) as clients,
             coalesce(sum(least(last_end, ${today}::date) - first_start + 1), 0) as days
      from (
        select client_id, min(starts_on) as first_start, max(ends_on) as last_end
        from subscriptions
        where status <> 'cancelled'
        group by client_id
      ) lives
    `);
    const [row] = result.rows;
    return { clients: Number(row.clients), totalDays: Number(row.days) };
  }

  /** The day a client's first subscription began. */
  async firstStart(clientId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ first: min(subscriptions.startsOn) })
      .from(subscriptions)
      .where(eq(subscriptions.clientId, clientId));
    return row?.first ?? null;
  }

  /** Clients with a subscription that is running or paused and whose term is not over. */
  async countActiveClients(today: string): Promise<number> {
    const [row] = await this.db
      .select({ total: countDistinct(subscriptions.clientId) })
      .from(subscriptions)
      .where(
        and(
          inArray(subscriptions.status, LIVE),
          gte(subscriptions.endsOn, today),
        ),
      );
    return row.total;
  }

  async countEndingBetween(from: string, to: string): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, SubscriptionStatus.ACTIVE),
          gte(subscriptions.endsOn, from),
          lte(subscriptions.endsOn, to),
        ),
      );
    return row.total;
  }
}
