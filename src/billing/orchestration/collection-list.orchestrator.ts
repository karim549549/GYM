import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../../common/handlers/base-query.handler';
import { TransactionManager } from '../../database/transaction.manager';
import type { InvoiceStatus } from '../enums/invoice-status.enum';
import { BillingQueryHandler } from '../handlers/billing-query.handler';
import type { CollectionInvoiceRecord } from '../interfaces/billing.interface';

/**
 * Takes over `BillingService.collections`: every coach's invoices, oldest first, for the platform's own
 * people to chase. It reads across workspaces, so it acts as the system.
 */
@Injectable()
export class CollectionListOrchestrator {
  constructor(
    private readonly billingQuery: BillingQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    status?: InvoiceStatus,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<CollectionInvoiceRecord>> {
    return this.transactions.run(
      () => this.billingQuery.listAllInvoices(status, page, limit),
      { system: true },
    );
  }
}
