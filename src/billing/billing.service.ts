import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import type { InvoiceStatus } from './enums/invoice-status.enum';
import type {
  BillingOverview,
  CollectionInvoiceRecord,
  InvoicePayment,
  InvoiceRecord,
  PlatformPlanRecord,
} from './interfaces/billing.interface';
import { BillingOverviewOrchestrator } from './orchestration/billing-overview.orchestrator';
import { CollectionListOrchestrator } from './orchestration/collection-list.orchestrator';
import { InvoiceListOrchestrator } from './orchestration/invoice-list.orchestrator';
import { InvoicePaymentOrchestrator } from './orchestration/invoice-payment.orchestrator';
import { InvoiceVoidingOrchestrator } from './orchestration/invoice-voiding.orchestrator';
import { PlanChangeOrchestrator } from './orchestration/plan-change.orchestrator';
import { PlatformAdminCheckOrchestrator } from './orchestration/platform-admin-check.orchestrator';
import { PlatformPlanListOrchestrator } from './orchestration/platform-plan-list.orchestrator';
import { StartFreePlanOrchestrator } from './orchestration/start-free-plan.orchestrator';

/** The billing module's interface: what coaches pay the platform, and the limit that comes with it. */
@Injectable()
export class BillingService {
  constructor(
    private readonly planList: PlatformPlanListOrchestrator,
    private readonly overviewOrchestrator: BillingOverviewOrchestrator,
    private readonly planChange: PlanChangeOrchestrator,
    private readonly invoiceList: InvoiceListOrchestrator,
    private readonly freePlan: StartFreePlanOrchestrator,
    private readonly collectionList: CollectionListOrchestrator,
    private readonly invoicePayment: InvoicePaymentOrchestrator,
    private readonly invoiceVoiding: InvoiceVoidingOrchestrator,
    private readonly adminCheck: PlatformAdminCheckOrchestrator,
  ) {}

  plans(): Promise<PlatformPlanRecord[]> {
    return this.planList.execute();
  }

  overview(workspaceId: string): Promise<BillingOverview> {
    return this.overviewOrchestrator.execute(workspaceId);
  }

  /** Asks for a plan: an invoice to pay, or at once for the free plan. Returns the overview that follows. */
  async changePlan(
    workspaceId: string,
    planId: string,
  ): Promise<BillingOverview> {
    await this.planChange.execute(workspaceId, planId);
    return this.overviewOrchestrator.execute(workspaceId);
  }

  invoices(
    workspaceId: string,
    status?: InvoiceStatus,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<InvoiceRecord>> {
    return this.invoiceList.execute(workspaceId, status, page, limit);
  }

  /** For a workspace that has just been created, inside the transaction that created it. */
  startFreePlan(workspaceId: string): Promise<void> {
    return this.freePlan.execute(workspaceId);
  }

  collections(
    status?: InvoiceStatus,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<CollectionInvoiceRecord>> {
    return this.collectionList.execute(status, page, limit);
  }

  markInvoicePaid(
    invoiceId: string,
    markedBy: string,
    payment: InvoicePayment,
  ): Promise<CollectionInvoiceRecord> {
    return this.invoicePayment.execute(invoiceId, markedBy, payment);
  }

  voidInvoice(
    invoiceId: string,
    markedBy: string,
  ): Promise<CollectionInvoiceRecord> {
    return this.invoiceVoiding.execute(invoiceId, markedBy);
  }

  isPlatformAdmin(personId: string): Promise<boolean> {
    return this.adminCheck.execute(personId);
  }
}
