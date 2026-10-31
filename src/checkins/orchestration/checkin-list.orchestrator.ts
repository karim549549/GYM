import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import type { PaginatedResponse } from '../../common/handlers/base-query.handler';
import { ConsentsService } from '../../consents/consents.service';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { CheckinsQueryHandler } from '../handlers/checkins-query.handler';
import type {
  CheckinFilter,
  CheckinRecord,
} from '../interfaces/checkin.interface';
import { CheckinStatePolicy } from '../policies/checkin-state.policy';
import { BaseCheckinOrchestrator } from './base-checkin.orchestrator';

/** Takes over `CheckinsService.list`: handed-in ones first, newest first, then the rest by day. */
@Injectable()
export class CheckinListOrchestrator extends BaseCheckinOrchestrator {
  constructor(
    checkinsQuery: CheckinsQueryHandler,
    config: ConfigService<Env, true>,
    dates: SubscriptionDatesPolicy,
    statePolicy: CheckinStatePolicy,
    transactions: TransactionManager,
    workspaces: WorkspacesService,
    private readonly consents: ConsentsService,
  ) {
    super(checkinsQuery, config, dates, statePolicy, transactions, workspaces);
  }

  execute(
    workspaceId: string,
    filter: CheckinFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<CheckinRecord>> {
    const today = this.dates.today(new Date());
    return this.transactions.run(
      async () => {
        const result = await this.checkinsQuery.list(
          filter,
          today,
          page,
          limit,
        );
        const handle = await this.handleOf(workspaceId);
        return {
          ...result,
          items: await this.withVisibleAnswers(
            this.consents,
            workspaceId,
            result.items.map((row) => this.present(row, today, handle)),
          ),
        };
      },
      { workspaceId },
    );
  }
}
