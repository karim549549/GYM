import { Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import {
  BaseQueryHandler,
  type PaginatedResponse,
} from '../../common/handlers/base-query.handler';
import {
  platformAdmins,
  platformInvoices,
  platformSubscriptions,
  plansCatalog,
} from '../../database/schema';
import { InvoiceStatus } from '../enums/invoice-status.enum';
import type { InvoicePaymentMethod } from '../enums/invoice-payment-method.enum';
import type {
  BillingPeriod,
  CollectionInvoiceRecord,
  InvoiceRecord,
  PlatformPlanRecord,
  StoredPlatformSubscription,
} from '../interfaces/billing.interface';

const PLAN = {
  id: plansCatalog.id,
  name: plansCatalog.name,
  priceMinor: plansCatalog.priceMinor,
  currency: plansCatalog.currency,
  clientLimit: plansCatalog.clientLimit,
  interval: plansCatalog.interval,
};

const INVOICE = {
  id: platformInvoices.id,
  planId: platformInvoices.planId,
  amountMinor: platformInvoices.amountMinor,
  currency: platformInvoices.currency,
  periodStart: platformInvoices.periodStart,
  periodEnd: platformInvoices.periodEnd,
  status: platformInvoices.status,
  method: platformInvoices.method,
  paidAt: platformInvoices.paidAt,
  createdAt: platformInvoices.createdAt,
};

/**
 * Data access for the catalog, a coach's plan with the platform, their invoices and the platform's
 * admins. A coach's own rows are kept to their workspace by row level security; the platform's people
 * reach every workspace's through the system scope.
 */
@Injectable()
export class BillingQueryHandler extends BaseQueryHandler {
  listPlans(): Promise<PlatformPlanRecord[]> {
    return this.db
      .select(PLAN)
      .from(plansCatalog)
      .orderBy(asc(plansCatalog.priceMinor), asc(plansCatalog.id));
  }

  async findPlan(id: string): Promise<PlatformPlanRecord | null> {
    const rows = await this.db
      .select(PLAN)
      .from(plansCatalog)
      .where(eq(plansCatalog.id, id))
      .limit(1);
    return this.firstOrNull(rows);
  }

  /** Locked until the transaction ends, so two changes to one coach's plan take turns. */
  async lockSubscription(
    workspaceId: string,
  ): Promise<StoredPlatformSubscription | null> {
    const rows = await this.db
      .select({
        planId: platformSubscriptions.planId,
        status: platformSubscriptions.status,
        currentPeriodStart: platformSubscriptions.currentPeriodStart,
        currentPeriodEnd: platformSubscriptions.currentPeriodEnd,
      })
      .from(platformSubscriptions)
      .where(eq(platformSubscriptions.workspaceId, workspaceId))
      .limit(1)
      .for('update');
    return this.firstOrNull(rows);
  }

  async insertSubscription(
    workspaceId: string,
    subscription: StoredPlatformSubscription,
  ): Promise<void> {
    await this.db
      .insert(platformSubscriptions)
      .values({ workspaceId, ...subscription });
  }

  async updateSubscription(
    workspaceId: string,
    subscription: StoredPlatformSubscription & { cancelAtPeriodEnd?: boolean },
  ): Promise<void> {
    await this.db
      .update(platformSubscriptions)
      .set(subscription)
      .where(eq(platformSubscriptions.workspaceId, workspaceId));
  }

  async createInvoice(
    workspaceId: string,
    invoice: {
      planId: string;
      amountMinor: number;
      currency: string;
      period: BillingPeriod;
    },
  ): Promise<InvoiceRecord> {
    const [created] = await this.db
      .insert(platformInvoices)
      .values({
        workspaceId,
        planId: invoice.planId,
        amountMinor: invoice.amountMinor,
        currency: invoice.currency,
        periodStart: invoice.period.start,
        periodEnd: invoice.period.end,
      })
      .returning(INVOICE);
    return created;
  }

  /** The newest invoice still waiting to be paid. */
  async findOpenInvoice(
    workspaceId: string,
    planId?: string,
  ): Promise<InvoiceRecord | null> {
    const rows = await this.db
      .select(INVOICE)
      .from(platformInvoices)
      .where(
        and(
          eq(platformInvoices.workspaceId, workspaceId),
          eq(platformInvoices.status, InvoiceStatus.OPEN),
          planId ? eq(platformInvoices.planId, planId) : undefined,
        ),
      )
      .orderBy(desc(platformInvoices.createdAt))
      .limit(1);
    return this.firstOrNull(rows);
  }

  listInvoices(
    workspaceId: string,
    status: InvoiceStatus | undefined,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<InvoiceRecord>> {
    const where = and(
      eq(platformInvoices.workspaceId, workspaceId),
      status ? eq(platformInvoices.status, status) : undefined,
    );
    return this.executePageQuery(
      {
        fetchItems: (take, skip) =>
          this.db
            .select(INVOICE)
            .from(platformInvoices)
            .where(where)
            .orderBy(
              desc(platformInvoices.createdAt),
              desc(platformInvoices.id),
            )
            .limit(take)
            .offset(skip),
        count: async () => {
          const [row] = await this.db
            .select({ total: count() })
            .from(platformInvoices)
            .where(where);
          return row.total;
        },
      },
      page,
      limit,
    );
  }

  /** The collections list across every workspace, oldest first. Only the system scope sees them all. */
  listAllInvoices(
    status: InvoiceStatus | undefined,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<CollectionInvoiceRecord>> {
    const where = status ? eq(platformInvoices.status, status) : undefined;
    return this.executePageQuery(
      {
        fetchItems: (take, skip) =>
          this.db
            .select({ ...INVOICE, workspaceId: platformInvoices.workspaceId })
            .from(platformInvoices)
            .where(where)
            .orderBy(asc(platformInvoices.createdAt), asc(platformInvoices.id))
            .limit(take)
            .offset(skip),
        count: async () => {
          const [row] = await this.db
            .select({ total: count() })
            .from(platformInvoices)
            .where(where);
          return row.total;
        },
      },
      page,
      limit,
    );
  }

  async findInvoice(id: string): Promise<CollectionInvoiceRecord | null> {
    const rows = await this.db
      .select({ ...INVOICE, workspaceId: platformInvoices.workspaceId })
      .from(platformInvoices)
      .where(eq(platformInvoices.id, id))
      .limit(1);
    return this.firstOrNull(rows);
  }

  /** Takes the invoice if it is still open: of two people confirming one transfer, one gets true. */
  async markPaid(
    id: string,
    payment: {
      method: InvoicePaymentMethod;
      paidAt: Date;
      markedBy: string;
      period: BillingPeriod;
    },
  ): Promise<boolean> {
    const rows = await this.db
      .update(platformInvoices)
      .set({
        status: InvoiceStatus.PAID,
        method: payment.method,
        paidAt: payment.paidAt,
        markedBy: payment.markedBy,
        periodStart: payment.period.start,
        periodEnd: payment.period.end,
      })
      .where(
        and(
          eq(platformInvoices.id, id),
          eq(platformInvoices.status, InvoiceStatus.OPEN),
        ),
      )
      .returning({ id: platformInvoices.id });
    return rows.length > 0;
  }

  /** Cancels an invoice still waiting to be paid. Returns whether there was one. */
  async voidInvoice(id: string, markedBy: string): Promise<boolean> {
    const rows = await this.db
      .update(platformInvoices)
      .set({ status: InvoiceStatus.VOID, markedBy })
      .where(
        and(
          eq(platformInvoices.id, id),
          eq(platformInvoices.status, InvoiceStatus.OPEN),
        ),
      )
      .returning({ id: platformInvoices.id });
    return rows.length > 0;
  }

  /** Cancels every invoice a coach has waiting, such as when they move to the free plan. */
  async voidOpenInvoices(workspaceId: string): Promise<void> {
    await this.db
      .update(platformInvoices)
      .set({ status: InvoiceStatus.VOID })
      .where(
        and(
          eq(platformInvoices.workspaceId, workspaceId),
          eq(platformInvoices.status, InvoiceStatus.OPEN),
        ),
      );
  }

  async isAdmin(personId: string): Promise<boolean> {
    const rows = await this.db
      .select({ personId: platformAdmins.personId })
      .from(platformAdmins)
      .where(eq(platformAdmins.personId, personId))
      .limit(1);
    return rows.length > 0;
  }
}
