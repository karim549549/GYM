import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { TransactionManager } from '../../database/transaction.manager';
import { PlanHasLaterWeeksException } from '../exceptions/plan-exceptions';
import { PlansQueryHandler } from '../handlers/plans-query.handler';
import type { NewPlan, PlanRecord } from '../interfaces/plan.interface';
import { BasePlanOrchestrator } from './base-plan.orchestrator';

/**
 * Takes over `PlansService.create`. A plan is for a client or, with no client, a template. Starting
 * from a copy of another plan or template is the usual way in: the structure is copied with the
 * exercise names as they were written, and the name, goal, length and notes default to the
 * original's.
 */
@Injectable()
export class PlanCreationOrchestrator extends BasePlanOrchestrator {
  private static readonly DEFAULT_WEEKS = 4;

  constructor(
    plansQuery: PlansQueryHandler,
    transactions: TransactionManager,
    private readonly clients: ClientsService,
  ) {
    super(plansQuery, transactions);
  }

  execute(
    workspaceId: string,
    createdBy: string,
    plan: NewPlan,
  ): Promise<PlanRecord> {
    return this.transactions.run(
      async () => {
        if (plan.clientId) {
          await this.clients.findOne(workspaceId, plan.clientId);
        }

        const source = plan.fromPlanId
          ? await this.mustFind(plan.fromPlanId)
          : null;
        const weeks =
          plan.weeks ?? source?.weeks ?? PlanCreationOrchestrator.DEFAULT_WEEKS;
        if (source && weeks < source.weeks) {
          throw new PlanHasLaterWeeksException();
        }

        const created = await this.plansQuery.create(workspaceId, createdBy, {
          name: plan.name,
          weeks,
          goal: plan.goal ?? source?.goal ?? undefined,
          notes: plan.notes ?? source?.notes ?? undefined,
          clientId: plan.clientId,
        });
        if (source) {
          await this.plansQuery.replaceDays(
            workspaceId,
            created.id,
            this.asStored(await this.plansQuery.loadDays(source.id)),
          );
        }
        return this.withDays(created);
      },
      { workspaceId },
    );
  }
}
