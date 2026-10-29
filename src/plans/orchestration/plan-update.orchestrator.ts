import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import {
  PlanEndedException,
  PlanHasLaterWeeksException,
} from '../exceptions/plan-exceptions';
import { PlansQueryHandler } from '../handlers/plans-query.handler';
import { PlanStatus } from '../enums/plan-status.enum';
import type { PlanChanges, PlanRecord } from '../interfaces/plan.interface';
import { BasePlanOrchestrator } from './base-plan.orchestrator';

/** Takes over `PlansService.update`: the plan's own details, not its days. A plan that ended no longer changes. */
@Injectable()
export class PlanUpdateOrchestrator extends BasePlanOrchestrator {
  constructor(plansQuery: PlansQueryHandler, transactions: TransactionManager) {
    super(plansQuery, transactions);
  }

  execute(
    workspaceId: string,
    planId: string,
    changes: PlanChanges,
  ): Promise<PlanRecord> {
    return this.transactions.run(
      async () => {
        const found = await this.mustFind(planId);
        if (found.status === PlanStatus.ENDED) {
          throw new PlanEndedException();
        }
        if (
          changes.weeks !== undefined &&
          changes.weeks < (await this.plansQuery.lastWeekOf(planId))
        ) {
          throw new PlanHasLaterWeeksException();
        }

        const updated = await this.plansQuery.update(planId, changes);
        return this.withDays(updated ?? found);
      },
      { workspaceId },
    );
  }
}
