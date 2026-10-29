import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import type {
  NewPayment,
  PaymentListFilter,
  PaymentRecord,
  PaymentSummary,
} from './interfaces/payment.interface';
import { PaymentRevenueOrchestrator } from './orchestration/payment-revenue.orchestrator';
import { PaymentListOrchestrator } from './orchestration/payment-list.orchestrator';
import { PaymentRecordingOrchestrator } from './orchestration/payment-recording.orchestrator';
import { PaymentSummaryOrchestrator } from './orchestration/payment-summary.orchestrator';
import { PaymentTotalsOrchestrator } from './orchestration/payment-totals.orchestrator';

/** The payments module's interface: the money coaches receive. */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentRecording: PaymentRecordingOrchestrator,
    private readonly paymentList: PaymentListOrchestrator,
    private readonly paymentSummary: PaymentSummaryOrchestrator,
    private readonly paymentTotals: PaymentTotalsOrchestrator,
    private readonly paymentRevenue: PaymentRevenueOrchestrator,
  ) {}

  /** For the subscription flow, which has checked that the payment is allowed. */
  record(workspaceId: string, payment: NewPayment): Promise<PaymentRecord> {
    return this.paymentRecording.execute(workspaceId, payment);
  }

  list(
    workspaceId: string,
    filter: PaymentListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<PaymentRecord>> {
    return this.paymentList.execute(workspaceId, filter, page, limit);
  }

  summary(
    workspaceId: string,
    from: string,
    to: string,
  ): Promise<PaymentSummary> {
    return this.paymentSummary.execute(workspaceId, from, to);
  }

  /** What was received in each month of a window, both ends included, and by how many different clients. */
  revenueByMonth(
    workspaceId: string,
    from: string,
    to: string,
  ): Promise<{
    months: { month: string; totalMinor: number }[];
    payers: number;
  }> {
    return this.paymentRevenue.execute(workspaceId, from, to);
  }

  totalsFor(
    workspaceId: string,
    subscriptionIds: string[],
  ): Promise<Map<string, number>> {
    return this.paymentTotals.execute(workspaceId, subscriptionIds);
  }
}
