import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { MealPlansQueryHandler } from '../handlers/meal-plans-query.handler';
import type { MealPlanRecord } from '../interfaces/meal-plan.interface';
import { MealPlanTotalsPolicy } from '../policies/meal-plan-totals.policy';
import { BaseMealPlanOrchestrator } from './base-meal-plan.orchestrator';

/**
 * Takes over `MealPlansService.saveAsTemplate`: any plan, a client's or another template, becomes
 * a template of the coach's own by copy, so a coach builds a plan once and reuses it.
 */
@Injectable()
export class MealPlanTemplateSavingOrchestrator extends BaseMealPlanOrchestrator {
  constructor(
    mealPlansQuery: MealPlansQueryHandler,
    totalsPolicy: MealPlanTotalsPolicy,
    transactions: TransactionManager,
  ) {
    super(mealPlansQuery, totalsPolicy, transactions);
  }

  execute(
    workspaceId: string,
    createdBy: string,
    planId: string,
    name: string,
  ): Promise<MealPlanRecord> {
    return this.transactions.run(
      async () => {
        const source = await this.mustFind(planId);
        const template = await this.mealPlansQuery.create(
          workspaceId,
          createdBy,
          {
            name,
            kcalTarget: source.kcalTarget,
            proteinTargetG: source.proteinTargetG,
            carbTargetG: source.carbTargetG,
            fatTargetG: source.fatTargetG,
            notes: source.notes ?? undefined,
          },
        );
        await this.mealPlansQuery.replaceMeals(
          workspaceId,
          template.id,
          this.asStored(await this.mealPlansQuery.loadMeals(planId)),
        );
        return this.withMeals(template);
      },
      { workspaceId },
    );
  }
}
