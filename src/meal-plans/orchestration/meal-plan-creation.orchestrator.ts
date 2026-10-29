import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { TransactionManager } from '../../database/transaction.manager';
import { MealPlansQueryHandler } from '../handlers/meal-plans-query.handler';
import type {
  MealPlanRecord,
  NewMealPlan,
} from '../interfaces/meal-plan.interface';
import { MealPlanTotalsPolicy } from '../policies/meal-plan-totals.policy';
import { BaseMealPlanOrchestrator } from './base-meal-plan.orchestrator';

/**
 * Takes over `MealPlansService.create`. A plan is for a client or, with no client, a template.
 * Starting from a copy of another plan or template is the usual way in: the meals are copied with
 * the numbers they were saved with, and the name, targets and notes default to the original's.
 */
@Injectable()
export class MealPlanCreationOrchestrator extends BaseMealPlanOrchestrator {
  constructor(
    mealPlansQuery: MealPlansQueryHandler,
    totalsPolicy: MealPlanTotalsPolicy,
    transactions: TransactionManager,
    private readonly clients: ClientsService,
  ) {
    super(mealPlansQuery, totalsPolicy, transactions);
  }

  execute(
    workspaceId: string,
    createdBy: string,
    plan: NewMealPlan,
  ): Promise<MealPlanRecord> {
    return this.transactions.run(
      async () => {
        if (plan.clientId) {
          await this.clients.findOne(workspaceId, plan.clientId);
        }

        const source = plan.fromPlanId
          ? await this.mustFind(plan.fromPlanId)
          : null;
        const created = await this.mealPlansQuery.create(
          workspaceId,
          createdBy,
          {
            name: plan.name,
            clientId: plan.clientId,
            kcalTarget: plan.kcalTarget ?? source?.kcalTarget,
            proteinTargetG: plan.proteinTargetG ?? source?.proteinTargetG,
            carbTargetG: plan.carbTargetG ?? source?.carbTargetG,
            fatTargetG: plan.fatTargetG ?? source?.fatTargetG,
            notes: plan.notes ?? source?.notes ?? undefined,
          },
        );
        if (source) {
          await this.mealPlansQuery.replaceMeals(
            workspaceId,
            created.id,
            this.asStored(await this.mealPlansQuery.loadMeals(source.id)),
          );
        }
        return this.withMeals(created);
      },
      { workspaceId },
    );
  }
}
