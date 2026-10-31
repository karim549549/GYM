import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { ConsentsService } from '../../consents/consents.service';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import {
  CheckinNotFoundException,
  CheckinNotSubmittedException,
} from '../exceptions/checkin-exceptions';
import { CheckinsQueryHandler } from '../handlers/checkins-query.handler';
import type { CheckinRecord } from '../interfaces/checkin.interface';
import { CheckinStatePolicy } from '../policies/checkin-state.policy';
import { BaseCheckinOrchestrator } from './base-checkin.orchestrator';

/** Takes over `CheckinsService.reply`: the coach answers what the client handed in, and may change the answer. */
@Injectable()
export class CheckinReplyOrchestrator extends BaseCheckinOrchestrator {
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
    repliedBy: string,
    checkinId: string,
    text: string,
  ): Promise<CheckinRecord> {
    const today = this.dates.today(new Date());
    return this.transactions.run(
      async () => {
        const found = await this.checkinsQuery.findById(checkinId);
        if (!found) {
          throw new CheckinNotFoundException();
        }
        if (!found.submittedAt) {
          throw new CheckinNotSubmittedException();
        }
        const replied = await this.checkinsQuery.setReply(
          checkinId,
          text,
          repliedBy,
        );
        const handle = await this.handleOf(workspaceId);
        const [visible] = await this.withVisibleAnswers(
          this.consents,
          workspaceId,
          [this.present(replied ?? found, today, handle)],
        );
        return visible;
      },
      { workspaceId },
    );
  }
}
