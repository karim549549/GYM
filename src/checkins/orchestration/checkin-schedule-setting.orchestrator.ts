import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsService } from '../../clients/clients.service';
import type { Env } from '../../config/env.schema';
import { TransactionManager } from '../../database/transaction.manager';
import { RemindersService } from '../../reminders/reminders.service';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { CheckinFrequency } from '../enums/checkin-frequency.enum';
import { CheckinsQueryHandler } from '../handlers/checkins-query.handler';
import type {
  CheckinScheduleInput,
  CheckinScheduleRecord,
} from '../interfaces/checkin.interface';
import { CheckinFormPolicy } from '../policies/checkin-form.policy';
import { CheckinSchedulePolicy } from '../policies/checkin-schedule.policy';
import { CheckinStatePolicy } from '../policies/checkin-state.policy';
import { BaseCheckinCreationOrchestrator } from './base-checkin-creation.orchestrator';

/**
 * Takes over `CheckinsService.setSchedule`. Setting it again changes the rhythm: the coming
 * check-ins nobody has answered are dropped, with their links not yet sent, and made again from
 * today. Today's stays, since its link may already be on the client's phone, and so do all that
 * were handed in.
 */
@Injectable()
export class CheckinScheduleSettingOrchestrator extends BaseCheckinCreationOrchestrator {
  private static readonly DEFAULT_SEND_AT = '08:00';

  constructor(
    checkinsQuery: CheckinsQueryHandler,
    config: ConfigService<Env, true>,
    dates: SubscriptionDatesPolicy,
    statePolicy: CheckinStatePolicy,
    transactions: TransactionManager,
    schedulePolicy: CheckinSchedulePolicy,
    formPolicy: CheckinFormPolicy,
    reminders: RemindersService,
    private readonly clients: ClientsService,
  ) {
    super(
      checkinsQuery,
      config,
      dates,
      statePolicy,
      transactions,
      schedulePolicy,
      formPolicy,
      reminders,
    );
  }

  execute(
    workspaceId: string,
    clientId: string,
    input: CheckinScheduleInput,
  ): Promise<CheckinScheduleRecord> {
    return this.transactions.run(
      async () => {
        await this.clients.findOne(workspaceId, clientId);

        const frequency = input.frequency ?? CheckinFrequency.WEEKLY;
        const today = this.dates.today(new Date());
        const cadence = {
          frequency,
          dayOfWeek: this.schedulePolicy.storedDayOfWeek(input.dayOfWeek),
        };
        const saved = await this.checkinsQuery.upsertSchedule(
          workspaceId,
          clientId,
          {
            ...cadence,
            sendAt:
              input.sendAt ??
              CheckinScheduleSettingOrchestrator.DEFAULT_SEND_AT,
            startsOn: input.startsOn ?? today,
          },
        );

        const dropped = await this.checkinsQuery.deleteOpenAfter(
          clientId,
          today,
        );
        await this.reminders.cancelCheckins(workspaceId, dropped);
        await this.createFor(
          workspaceId,
          { id: saved.id, clientId, sendAt: saved.sendAt },
          this.schedulePolicy.dueDatesFrom(
            cadence,
            this.schedulePolicy.startFor(saved.startsOn, today),
            this.horizonFrom(today),
          ),
        );

        const { id: _scheduleId, ...record } = saved;
        return record;
      },
      { workspaceId },
    );
  }
}
