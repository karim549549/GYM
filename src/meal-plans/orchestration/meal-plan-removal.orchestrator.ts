import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { MealPlanStatus } from '../enums/meal-plan-status.enum';
import { MealPlanNotDeletableException } from '../exceptions/meal-plan-exceptions';
import { MealPlansQueryHandler } from '../handlers/meal-plans-query.handler';
import { MealPlanTotalsPolicy } from '../policies/meal-plan-totals.policy';
import { BaseMealPlanOrchestrator } from './base-meal-plan.orchestrator';

/**
 * Takes over `MealPlansService.remove`. A draft, or a template, was never followed and can go. A
 * plan that ran is what the client's record points at, so it stays.
 */
@Injectable()
export class MealPlanRemovalOrchestrator extends BaseMealPlanOrchestrator {
  constructor(
    mealPlansQuery: MealPlansQueryHandler,
    totalsPolicy: MealPlanTotalsPolicy,
    transactions: TransactionManager,
  ) {
    super(mealPlansQuery, totalsPolicy, transactions);
  }

  execute(workspaceId: string, planId: string): Promise<void> {
    return this.transactions.run(
      async () => {
        const plan = await this.mustFind(planId);
        if (!plan.isTemplate && plan.status !== MealPlanStatus.DRAFT) {
          throw new MealPlanNotDeletableException();
        }
        await this.mealPlansQuery.remove(planId);
      },
      { workspaceId },
    );
  }
}
