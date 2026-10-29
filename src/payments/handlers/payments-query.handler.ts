import { Injectable } from '@nestjs/common';
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  lte,
  sql,
} from 'drizzle-orm';
import {
  BaseQueryHandler,
  type PaginatedResponse,
} from '../../common/handlers/base-query.handler';
import { payments } from '../../database/schema';
import type { PaymentMethod } from '../enums/payment-method.enum';
import type {
  NewPayment,
  PaymentListFilter,
  PaymentRecord,
  PaymentSummary,
} from '../interfaces/payment.interface';

const RECORD = {
  id: payments.id,
  subscriptionId: payments.subscriptionId,
  clientId: payments.clientId,
  amountMinor: payments.amountMinor,
  currency: payments.currency,
  method: payments.method,
  paidOn: payments.paidOn,
  note: payments.note,
  createdAt: payments.createdAt,
};

type StoredPayment = Omit<PaymentRecord, 'receiptUrl'>;

/** Data access for the `payments` table. Row level security keeps it to one workspace. */
@Injectable()
export class PaymentsQueryHandler extends BaseQueryHandler {
  async create(
    workspaceId: string,
    payment: NewPayment,
  ): Promise<StoredPayment> {
    const [created] = await this.db
      .insert(payments)
      .values({ workspaceId, ...payment })
      .returning(RECORD);
    return created;
  }

  /** Newest first: by the day the money arrived, then by when it was recorded. */
  list(
    filter: PaymentListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<StoredPayment>> {
    const where = this.matching(filter);
    return this.executePageQuery(
      {
        fetchItems: (take, skip) =>
          this.db
            .select(RECORD)
            .from(payments)
            .where(where)
            .orderBy(
              desc(payments.paidOn),
              desc(payments.createdAt),
              desc(payments.id),
            )
            .limit(take)
            .offset(skip),
        count: async () => {
          const [row] = await this.db
            .select({ total: count() })
            .from(payments)
            .where(where);
          return row.total;
        },
      },
      page,
      limit,
    );
  }

  /** What each of these subscriptions has received so far; one without a payment is absent. */
  async totalsBySubscription(
    subscriptionIds: string[],
  ): Promise<Map<string, number>> {
    if (subscriptionIds.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .select({
        subscriptionId: payments.subscriptionId,
        total: sql<string>`sum(${payments.amountMinor})`,
      })
      .from(payments)
      .where(inArray(payments.subscriptionId, subscriptionIds))
      .groupBy(payments.subscriptionId);
    return new Map(rows.map((row) => [row.subscriptionId, Number(row.total)]));
  }

  /** What was received in each month of a window (both ends included), and by how many different clients. */
  async revenueByMonth(
    from: string,
    to: string,
  ): Promise<{
    months: { month: string; totalMinor: number }[];
    payers: number;
  }> {
    const window = and(gte(payments.paidOn, from), lte(payments.paidOn, to));
    const rows = await this.db
      .select({
        month: sql<string>`to_char(${payments.paidOn}, 'YYYY-MM')`,
        total: sql<string>`sum(${payments.amountMinor})`,
      })
      .from(payments)
      .where(window)
      .groupBy(sql`to_char(${payments.paidOn}, 'YYYY-MM')`);
    const [payers] = await this.db
      .select({ total: countDistinct(payments.clientId) })
      .from(payments)
      .where(window);
    return {
      months: rows.map((row) => ({
        month: row.month,
        totalMinor: Number(row.total),
      })),
      payers: payers.total,
    };
  }

  async summary(from: string, to: string): Promise<PaymentSummary> {
    const rows = await this.db
      .select({
        method: payments.method,
        total: sql<string>`sum(${payments.amountMinor})`,
        count: count(),
      })
      .from(payments)
      .where(and(gte(payments.paidOn, from), lte(payments.paidOn, to)))
      .groupBy(payments.method);

    const byMethod: Partial<Record<PaymentMethod, number>> = {};
    let totalMinor = 0;
    let total = 0;
    for (const row of rows) {
      byMethod[row.method] = Number(row.total);
      totalMinor += Number(row.total);
      total += row.count;
    }
    return { totalMinor, count: total, byMethod };
  }

  private matching(filter: PaymentListFilter) {
    return and(
      filter.clientId ? eq(payments.clientId, filter.clientId) : undefined,
      filter.subscriptionId
        ? eq(payments.subscriptionId, filter.subscriptionId)
        : undefined,
      filter.method ? eq(payments.method, filter.method) : undefined,
      filter.from ? gte(payments.paidOn, filter.from) : undefined,
      filter.to ? lte(payments.paidOn, filter.to) : undefined,
    );
  }
}
