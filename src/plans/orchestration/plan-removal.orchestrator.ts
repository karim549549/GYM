import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PlanStatus } from '../enums/plan-status.enum';
import { PlanNotDeletableException } from '../exceptions/plan-exceptions';
import { PlansQueryHandler } from '../handlers/plans-query.handler';
import { BasePlanOrchestrator } from './base-plan.orchestrator';

/**
 * Takes over `PlansService.remove`. A draft, or a template, was never followed and can go. A plan
 * that ran is what the client's training history points at, so it stays.
 */
@Injectable()
export class PlanRemovalOrchestrator extends BasePlanOrchestrator {
  constructor(plansQuery: PlansQueryHandler, transactions: TransactionManager) {
    super(plansQuery, transactions);
  }

  execute(workspaceId: string, planId: string): Promise<void> {
    return this.transactions.run(
      async () => {
        const plan = await this.mustFind(planId);
        if (!plan.isTemplate && plan.status !== PlanStatus.DRAFT) {
          throw new PlanNotDeletableException();
        }
        await this.plansQuery.remove(planId);
      },
      { workspaceId },
    );
  }
}
