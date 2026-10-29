import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { MealPlansQueryHandler } from '../handlers/meal-plans-query.handler';
import type { MealPlanRecord } from '../interfaces/meal-plan.interface';
import { MealPlanTotalsPolicy } from '../policies/meal-plan-totals.policy';
import { BaseMealPlanOrchestrator } from './base-meal-plan.orchestrator';

/** Takes over `MealPlansService.findOne`: a plan with every meal, item and substitute, and its totals. */
@Injectable()
export class MealPlanDetailsOrchestrator extends BaseMealPlanOrchestrator {
  constructor(
    mealPlansQuery: MealPlansQueryHandler,
    totalsPolicy: MealPlanTotalsPolicy,
    transactions: TransactionManager,
  ) {
    super(mealPlansQuery, totalsPolicy, transactions);
  }

  execute(workspaceId: string, planId: string): Promise<MealPlanRecord> {
    return this.transactions.run(
      async () => this.withMeals(await this.mustFind(planId)),
      { workspaceId },
    );
  }
}
