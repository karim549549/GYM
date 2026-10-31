import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PlansQueryHandler } from '../handlers/plans-query.handler';
import type { PlanRecord } from '../interfaces/plan.interface';
import { BasePlanOrchestrator } from './base-plan.orchestrator';

/** Takes over `PlansService.findActiveOfClient`: the plan a client follows now, with everything in it, or none. */
@Injectable()
export class PlanActiveOfClientOrchestrator extends BasePlanOrchestrator {
  constructor(plansQuery: PlansQueryHandler, transactions: TransactionManager) {
    super(plansQuery, transactions);
  }

  execute(workspaceId: string, clientId: string): Promise<PlanRecord | null> {
    return this.transactions.run(
      async () => {
        const active = await this.plansQuery.findActiveOfClient(clientId);
        return active ? this.withDays(active) : null;
      },
      { workspaceId },
    );
  }
}
