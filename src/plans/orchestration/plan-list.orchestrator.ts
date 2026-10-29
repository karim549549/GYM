import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../../common/handlers/base-query.handler';
import { TransactionManager } from '../../database/transaction.manager';
import { PlansQueryHandler } from '../handlers/plans-query.handler';
import type { PlanListFilter, PlanSummary } from '../interfaces/plan.interface';

/** Takes over `PlansService.list`: plans without their days, newest first. */
@Injectable()
export class PlanListOrchestrator {
  constructor(
    private readonly plansQuery: PlansQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    filter: PlanListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<PlanSummary>> {
    return this.transactions.run(
      () => this.plansQuery.list(filter, page, limit),
      { workspaceId },
    );
  }
}
