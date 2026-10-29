import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { MealPlanStatus } from '../enums/meal-plan-status.enum';
import {
  MealPlanActivationConflictException,
  MealPlanIsTemplateException,
  MealPlanNotDraftException,
} from '../exceptions/meal-plan-exceptions';
import { MealPlansQueryHandler } from '../handlers/meal-plans-query.handler';
import type { MealPlanRecord } from '../interfaces/meal-plan.interface';
import { MealPlanTotalsPolicy } from '../policies/meal-plan-totals.policy';
import { BaseMealPlanOrchestrator } from './base-meal-plan.orchestrator';

/**
 * Takes over `MealPlansService.activate`: the client starts following a draft plan. The plan they
 * were following ends, since a client has one at a time; the database refuses a second active
 * plan, so two starts at once leave one winner and one told to try again.
 */
@Injectable()
export class MealPlanActivationOrchestrator extends BaseMealPlanOrchestrator {
  constructor(
    mealPlansQuery: MealPlansQueryHandler,
    totalsPolicy: MealPlanTotalsPolicy,
    transactions: TransactionManager,
    private readonly dates: SubscriptionDatesPolicy,
  ) {
    super(mealPlansQuery, totalsPolicy, transactions);
  }

  async execute(
    workspaceId: string,
    planId: string,
    startsOn?: string,
  ): Promise<MealPlanRecord> {
    try {
      return await this.transactions.run(
        async () => {
          const plan = await this.mustFind(planId);
          if (plan.isTemplate || !plan.clientId) {
            throw new MealPlanIsTemplateException();
          }
          if (plan.status !== MealPlanStatus.DRAFT) {
            throw new MealPlanNotDraftException();
          }

          await this.mealPlansQuery.endActiveOfClient(plan.clientId, planId);
          await this.mealPlansQuery.setStatus(
            planId,
            MealPlanStatus.ACTIVE,
            startsOn ?? this.dates.today(new Date()),
          );
          return this.withMeals(await this.mustFind(planId));
        },
        { workspaceId },
      );
    } catch (error) {
      throw MealPlanActivationConflictException.causes(error)
        ? new MealPlanActivationConflictException()
        : error;
    }
  }
}
