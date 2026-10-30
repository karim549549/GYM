import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientNotFoundException } from '../../clients/exceptions/client-exceptions';
import { ClientsService } from '../../clients/clients.service';
import type { Env } from '../../config/env.schema';
import { TransactionManager } from '../../database/transaction.manager';
import { RemindersService } from '../../reminders/reminders.service';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { CheckinsQueryHandler } from '../handlers/checkins-query.handler';
import type { ActiveSchedule } from '../interfaces/checkin.interface';
import { CheckinFormPolicy } from '../policies/checkin-form.policy';
import { CheckinSchedulePolicy } from '../policies/checkin-schedule.policy';
import { CheckinStatePolicy } from '../policies/checkin-state.policy';
import { BaseCheckinCreationOrchestrator } from './base-checkin-creation.orchestrator';

/**
 * Takes over `CheckinsService.topUp`, which the job runs. Check-ins are made a month ahead, so
 * something has to keep making them as the days pass. The schedules of every workspace are read as
 * the system (which may read nothing else); each is then topped up inside its own workspace, from
 * the day after its last check-in so a fortnightly rhythm never shifts. Returns how many were made.
 */
@Injectable()
export class CheckinTopUpOrchestrator extends BaseCheckinCreationOrchestrator {
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

  async execute(signal?: AbortSignal): Promise<number> {
    signal?.throwIfAborted();
    const schedules = await this.transactions.run(
      () => this.checkinsQuery.listActiveSchedules(),
      { system: true },
    );

    return schedules.reduce(async (pendingCount, schedule) => {
      const made = await pendingCount;
      signal?.throwIfAborted();
      return made + (await this.topUp(schedule, signal));
    }, Promise.resolve(0));
  }

  private async topUp(
    schedule: ActiveSchedule,
    signal?: AbortSignal,
  ): Promise<number> {
    try {
      return await this.transactions.run(
        async () => {
          await this.clients.findOne(schedule.workspaceId, schedule.clientId);

          const today = this.dates.today(new Date());
          const horizon = this.horizonFrom(today);
          const last = await this.checkinsQuery.lastDueOn(schedule.clientId);
          const days = last
            ? this.schedulePolicy.dueDatesAfter(schedule, last, horizon)
            : this.schedulePolicy.dueDatesFrom(
                schedule,
                this.schedulePolicy.startFor(schedule.startsOn, today),
                horizon,
              );
          signal?.throwIfAborted();
          return this.createFor(schedule.workspaceId, schedule, days);
        },
        { workspaceId: schedule.workspaceId },
      );
    } catch (error) {
      // a client removed since the schedule was set has nobody to ask; the others carry on
      if (error instanceof ClientNotFoundException) {
        return 0;
      }
      throw error;
    }
  }
}
