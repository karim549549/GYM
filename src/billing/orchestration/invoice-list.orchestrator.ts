import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../../common/handlers/base-query.handler';
import { TransactionManager } from '../../database/transaction.manager';
import type { InvoiceStatus } from '../enums/invoice-status.enum';
import { BillingQueryHandler } from '../handlers/billing-query.handler';
import type { InvoiceRecord } from '../interfaces/billing.interface';

/** Takes over `BillingService.invoices`: what the coach has been billed, newest first. */
@Injectable()
export class InvoiceListOrchestrator {
  constructor(
    private readonly billingQuery: BillingQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    status?: InvoiceStatus,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<InvoiceRecord>> {
    return this.transactions.run(
      () => this.billingQuery.listInvoices(workspaceId, status, page, limit),
      { workspaceId },
    );
  }
}
