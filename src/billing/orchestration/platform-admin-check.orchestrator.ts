import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { BillingQueryHandler } from '../handlers/billing-query.handler';

/** Takes over `BillingService.isPlatformAdmin`: whether this person runs the platform. */
@Injectable()
export class PlatformAdminCheckOrchestrator {
  constructor(
    private readonly billingQuery: BillingQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(personId: string): Promise<boolean> {
    return this.transactions.run(() => this.billingQuery.isAdmin(personId));
  }
}
