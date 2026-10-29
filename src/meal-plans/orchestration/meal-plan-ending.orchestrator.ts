import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { MealPlanStatus } from '../enums/meal-plan-status.enum';
import { MealPlanNotActiveException } from '../exceptions/meal-plan-exceptions';
import { MealPlansQueryHandler } from '../handlers/meal-plans-query.handler';
import type { MealPlanRecord } from '../interfaces/meal-plan.interface';
import { MealPlanTotalsPolicy } from '../policies/meal-plan-totals.policy';
import { BaseMealPlanOrchestrator } from './base-meal-plan.orchestrator';

/** Takes over `MealPlansService.end`: the client's running plan is done. It is kept as their record. */
@Injectable()
export class MealPlanEndingOrchestrator extends BaseMealPlanOrchestrator {
  constructor(
    mealPlansQuery: MealPlansQueryHandler,
    totalsPolicy: MealPlanTotalsPolicy,
    transactions: TransactionManager,
  ) {
    super(mealPlansQuery, totalsPolicy, transactions);
  }

  execute(workspaceId: string, planId: string): Promise<MealPlanRecord> {
    return this.transactions.run(
      async () => {
        const plan = await this.mustFind(planId);
        if (plan.status !== MealPlanStatus.ACTIVE) {
          throw new MealPlanNotActiveException();
        }
        await this.mealPlansQuery.setStatus(planId, MealPlanStatus.ENDED);
        return this.withMeals(await this.mustFind(planId));
      },
      { workspaceId },
    );
  }
}
