import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { ConsentsService } from '../../consents/consents.service';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { CheckinNotFoundException } from '../exceptions/checkin-exceptions';
import { CheckinsQueryHandler } from '../handlers/checkins-query.handler';
import type { CheckinRecord } from '../interfaces/checkin.interface';
import { CheckinStatePolicy } from '../policies/checkin-state.policy';
import { BaseCheckinOrchestrator } from './base-checkin.orchestrator';

/** Takes over `CheckinsService.findOne`. */
@Injectable()
export class CheckinDetailsOrchestrator extends BaseCheckinOrchestrator {
  constructor(
    checkinsQuery: CheckinsQueryHandler,
    config: ConfigService<Env, true>,
    dates: SubscriptionDatesPolicy,
    statePolicy: CheckinStatePolicy,
    transactions: TransactionManager,
    private readonly consents: ConsentsService,
  ) {
    super(checkinsQuery, config, dates, statePolicy, transactions);
  }

  execute(workspaceId: string, checkinId: string): Promise<CheckinRecord> {
    const today = this.dates.today(new Date());
    return this.transactions.run(
      async () => {
        const found = await this.checkinsQuery.findById(checkinId);
        if (!found) {
          throw new CheckinNotFoundException();
        }
        const [visible] = await this.withVisibleAnswers(
          this.consents,
          workspaceId,
          [this.present(found, today)],
        );
        return visible;
      },
      { workspaceId },
    );
  }
}
