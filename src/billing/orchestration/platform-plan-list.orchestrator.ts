import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { BillingQueryHandler } from '../handlers/billing-query.handler';
import type { PlatformPlanRecord } from '../interfaces/billing.interface';

/** Takes over `BillingService.plans`: what the platform sells, the same for every coach, cheapest first. */
@Injectable()
export class PlatformPlanListOrchestrator {
  constructor(
    private readonly billingQuery: BillingQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(): Promise<PlatformPlanRecord[]> {
    return this.transactions.run(() => this.billingQuery.listPlans());
  }
}
