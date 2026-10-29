import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PlanStatus } from '../enums/plan-status.enum';
import { PlanNotActiveException } from '../exceptions/plan-exceptions';
import { PlansQueryHandler } from '../handlers/plans-query.handler';
import type { PlanRecord } from '../interfaces/plan.interface';
import { BasePlanOrchestrator } from './base-plan.orchestrator';

/** Takes over `PlansService.end`: the client's running plan is done. It is kept as their record. */
@Injectable()
export class PlanEndingOrchestrator extends BasePlanOrchestrator {
  constructor(plansQuery: PlansQueryHandler, transactions: TransactionManager) {
    super(plansQuery, transactions);
  }

  execute(workspaceId: string, planId: string): Promise<PlanRecord> {
    return this.transactions.run(
      async () => {
        const plan = await this.mustFind(planId);
        if (plan.status !== PlanStatus.ACTIVE) {
          throw new PlanNotActiveException();
        }
        await this.plansQuery.setStatus(planId, PlanStatus.ENDED);
        return this.withDays(await this.mustFind(planId));
      },
      { workspaceId },
    );
  }
}
