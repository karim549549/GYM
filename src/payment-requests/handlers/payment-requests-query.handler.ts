import { Injectable } from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  sql,
} from 'drizzle-orm';
import {
  BaseQueryHandler,
  type PaginatedResponse,
} from '../../common/handlers/base-query.handler';
import { paymentRequests } from '../../database/schema';
import type { PaymentMethod } from '../../payments/enums/payment-method.enum';
import type {
  NewPaymentRequest,
  StoredPaymentRequest,
} from '../interfaces/payment-request.interface';

const COLUMNS = {
  id: paymentRequests.id,
  workspaceId: paymentRequests.workspaceId,
  subscriptionId: paymentRequests.subscriptionId,
  clientId: paymentRequests.clientId,
  token: paymentRequests.token,
  clientName: paymentRequests.clientName,
  packageName: paymentRequests.packageName,
  amountMinor: paymentRequests.amountMinor,
  currency: paymentRequests.currency,
  note: paymentRequests.note,
  expiresAt: paymentRequests.expiresAt,
  paidAt: paymentRequests.paidAt,
  paidMethod: paymentRequests.paidMethod,
  receiptKey: paymentRequests.receiptKey,
  paymentId: paymentRequests.paymentId,
  createdAt: paymentRequests.createdAt,
};

/** Data access for `payment_requests`. Row level security keeps it to one workspace, or to one link by its token. */
@Injectable()
export class PaymentRequestsQueryHandler extends BaseQueryHandler {
  async create(
    workspaceId: string,
    request: NewPaymentRequest,
  ): Promise<StoredPaymentRequest> {
    const [created] = await this.db
      .insert(paymentRequests)
      .values({ workspaceId, ...request })
      .returning(COLUMNS);
    return created;
  }

  /** Only visible while acting under that token (see the `paymentToken` scope): no workspace is needed to find it. */
  async findByToken(token: string): Promise<StoredPaymentRequest | null> {
    const rows = await this.db
      .select(COLUMNS)
      .from(paymentRequests)
      .where(eq(paymentRequests.token, token))
      .limit(1);
    return this.firstOrNull(rows);
  }

  async findById(id: string): Promise<StoredPaymentRequest | null> {
    const rows = await this.db
      .select(COLUMNS)
      .from(paymentRequests)
      .where(eq(paymentRequests.id, id))
      .limit(1);
    return this.firstOrNull(rows);
  }

  list(
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<StoredPaymentRequest>> {
    return this.executePageQuery(
      {
        fetchItems: (take, offset) =>
          this.db
            .select(COLUMNS)
            .from(paymentRequests)
            .orderBy(desc(paymentRequests.createdAt), desc(paymentRequests.id))
            .limit(take)
            .offset(offset),
        count: async () => {
          const [row] = await this.db
            .select({ total: count() })
            .from(paymentRequests);
          return row.total;
        },
      },
      page,
      limit,
    );
  }

  /**
   * The client says they paid, with their screenshot. Taken atomically and only while the request is open, so of two reports at
   * once one wins, and a link past its date cannot be reported. Returns whether this call was the one.
   */
  async markPaid(
    id: string,
    method: PaymentMethod,
    receiptKey: string,
  ): Promise<boolean> {
    const rows = await this.db
      .update(paymentRequests)
      .set({ paidAt: sql`now()`, paidMethod: method, receiptKey })
      .where(
        and(
          eq(paymentRequests.id, id),
          isNull(paymentRequests.paidAt),
          gt(paymentRequests.expiresAt, sql`now()`),
        ),
      )
      .returning({ id: paymentRequests.id });
    return rows.length > 0;
  }

  /**
   * The coach accepted the client's report and a payment was recorded. Atomic, and only for a report not
   * confirmed yet, so two taps leave one payment. Returns whether this call was the one.
   */
  async markConfirmed(id: string, paymentId: string): Promise<boolean> {
    const rows = await this.db
      .update(paymentRequests)
      .set({ paymentId })
      .where(
        and(
          eq(paymentRequests.id, id),
          isNotNull(paymentRequests.paidAt),
          isNull(paymentRequests.paymentId),
        ),
      )
      .returning({ id: paymentRequests.id });
    return rows.length > 0;
  }
}
