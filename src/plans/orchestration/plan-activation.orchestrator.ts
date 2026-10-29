import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { PlanStatus } from '../enums/plan-status.enum';
import {
  PlanActivationConflictException,
  PlanIsTemplateException,
  PlanNotDraftException,
} from '../exceptions/plan-exceptions';
import { PlansQueryHandler } from '../handlers/plans-query.handler';
import type { PlanRecord } from '../interfaces/plan.interface';
import { BasePlanOrchestrator } from './base-plan.orchestrator';

/**
 * Takes over `PlansService.activate`: the client starts following a draft plan. The plan they were
 * following ends, since a client has one at a time; the database refuses a second active plan, so
 * two starts at once leave one winner and one told to try again.
 */
@Injectable()
export class PlanActivationOrchestrator extends BasePlanOrchestrator {
  constructor(
    plansQuery: PlansQueryHandler,
    transactions: TransactionManager,
    private readonly dates: SubscriptionDatesPolicy,
  ) {
    super(plansQuery, transactions);
  }

  async execute(
    workspaceId: string,
    planId: string,
    startsOn?: string,
  ): Promise<PlanRecord> {
    try {
      return await this.transactions.run(
        async () => {
          const plan = await this.mustFind(planId);
          if (plan.isTemplate || !plan.clientId) {
            throw new PlanIsTemplateException();
          }
          if (plan.status !== PlanStatus.DRAFT) {
            throw new PlanNotDraftException();
          }

          await this.plansQuery.endActiveOfClient(plan.clientId, planId);
          await this.plansQuery.setStatus(
            planId,
            PlanStatus.ACTIVE,
            startsOn ?? this.dates.today(new Date()),
          );
          return this.withDays(await this.mustFind(planId));
        },
        { workspaceId },
      );
    } catch (error) {
      throw PlanActivationConflictException.causes(error)
        ? new PlanActivationConflictException()
        : error;
    }
  }
}
