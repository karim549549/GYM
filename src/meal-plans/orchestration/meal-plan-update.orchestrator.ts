import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { MealPlanStatus } from '../enums/meal-plan-status.enum';
import { MealPlanEndedException } from '../exceptions/meal-plan-exceptions';
import { MealPlansQueryHandler } from '../handlers/meal-plans-query.handler';
import type {
  MealPlanChanges,
  MealPlanRecord,
} from '../interfaces/meal-plan.interface';
import { MealPlanTotalsPolicy } from '../policies/meal-plan-totals.policy';
import { BaseMealPlanOrchestrator } from './base-meal-plan.orchestrator';

/** Takes over `MealPlansService.update`: the plan's name, targets and notes, not its meals. A plan that ended no longer changes. */
@Injectable()
export class MealPlanUpdateOrchestrator extends BaseMealPlanOrchestrator {
  constructor(
    mealPlansQuery: MealPlansQueryHandler,
    totalsPolicy: MealPlanTotalsPolicy,
    transactions: TransactionManager,
  ) {
    super(mealPlansQuery, totalsPolicy, transactions);
  }

  execute(
    workspaceId: string,
    planId: string,
    changes: MealPlanChanges,
  ): Promise<MealPlanRecord> {
    return this.transactions.run(
      async () => {
        const found = await this.mustFind(planId);
        if (found.status === MealPlanStatus.ENDED) {
          throw new MealPlanEndedException();
        }
        const updated = await this.mealPlansQuery.update(planId, changes);
        return this.withMeals(updated ?? found);
      },
      { workspaceId },
    );
  }
}
