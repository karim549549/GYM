import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../../common/handlers/base-query.handler';
import { TransactionManager } from '../../database/transaction.manager';
import { MealPlansQueryHandler } from '../handlers/meal-plans-query.handler';
import type {
  MealPlanListFilter,
  MealPlanSummary,
} from '../interfaces/meal-plan.interface';

/** Takes over `MealPlansService.list`: plans without their meals, newest first. */
@Injectable()
export class MealPlanListOrchestrator {
  constructor(
    private readonly mealPlansQuery: MealPlansQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    filter: MealPlanListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<MealPlanSummary>> {
    return this.transactions.run(
      () => this.mealPlansQuery.list(filter, page, limit),
      { workspaceId },
    );
  }
}
