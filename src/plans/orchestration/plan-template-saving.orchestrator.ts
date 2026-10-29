import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PlansQueryHandler } from '../handlers/plans-query.handler';
import type { PlanRecord } from '../interfaces/plan.interface';
import { BasePlanOrchestrator } from './base-plan.orchestrator';

/**
 * Takes over `PlansService.saveAsTemplate`: any plan, a client's or another template, becomes a
 * template of the coach's own by copy, so a coach builds a program once and reuses it.
 */
@Injectable()
export class PlanTemplateSavingOrchestrator extends BasePlanOrchestrator {
  constructor(plansQuery: PlansQueryHandler, transactions: TransactionManager) {
    super(plansQuery, transactions);
  }

  execute(
    workspaceId: string,
    createdBy: string,
    planId: string,
    name: string,
  ): Promise<PlanRecord> {
    return this.transactions.run(
      async () => {
        const source = await this.mustFind(planId);
        const template = await this.plansQuery.create(workspaceId, createdBy, {
          name,
          weeks: source.weeks,
          goal: source.goal ?? undefined,
          notes: source.notes ?? undefined,
        });
        await this.plansQuery.replaceDays(
          workspaceId,
          template.id,
          this.asStored(await this.plansQuery.loadDays(planId)),
        );
        return this.withDays(template);
      },
      { workspaceId },
    );
  }
}
