import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PlansQueryHandler } from '../handlers/plans-query.handler';
import type { PlanRecord } from '../interfaces/plan.interface';
import { BasePlanOrchestrator } from './base-plan.orchestrator';

/** Takes over `PlansService.findOne`: a plan with every week, day, exercise and set. */
@Injectable()
export class PlanDetailsOrchestrator extends BasePlanOrchestrator {
  constructor(plansQuery: PlansQueryHandler, transactions: TransactionManager) {
    super(plansQuery, transactions);
  }

  execute(workspaceId: string, planId: string): Promise<PlanRecord> {
    return this.transactions.run(
      async () => this.withDays(await this.mustFind(planId)),
      { workspaceId },
    );
  }
}
