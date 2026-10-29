import { TransactionManager } from '../../database/transaction.manager';
import { PlatformPlan } from '../enums/platform-plan.enum';
import { PlatformSubscriptionStatus } from '../enums/platform-subscription-status.enum';
import { PlatformPlanNotFoundException } from '../exceptions/billing-exceptions';
import { BillingQueryHandler } from '../handlers/billing-query.handler';
import type {
  PlatformPlanRecord,
  StoredPlatformSubscription,
} from '../interfaces/billing.interface';

/** What the flows that touch a coach's plan share. Call it inside the flow's transaction. */
export abstract class BaseBillingOrchestrator {
  /** A free plan has no period to run out, so its period ends on the last date there is. */
  protected static readonly NO_END = '9999-12-31';

  constructor(
    protected readonly billingQuery: BillingQueryHandler,
    protected readonly transactions: TransactionManager,
  ) {}

  protected async mustFindPlan(planId: string): Promise<PlatformPlanRecord> {
    const plan = await this.billingQuery.findPlan(planId);
    if (!plan) {
      throw new PlatformPlanNotFoundException();
    }
    return plan;
  }

  /** The coach's plan with the platform, locked; a workspace that somehow has none is put on the free plan. */
  protected async subscriptionOf(
    workspaceId: string,
    today: string,
  ): Promise<StoredPlatformSubscription> {
    const found = await this.billingQuery.lockSubscription(workspaceId);
    if (found) {
      return found;
    }
    const free = this.freePlan(today);
    await this.billingQuery.insertSubscription(workspaceId, free);
    return free;
  }

  protected freePlan(today: string): StoredPlatformSubscription {
    return {
      planId: PlatformPlan.FREE,
      status: PlatformSubscriptionStatus.ACTIVE,
      currentPeriodStart: today,
      currentPeriodEnd: BaseBillingOrchestrator.NO_END,
    };
  }
}
