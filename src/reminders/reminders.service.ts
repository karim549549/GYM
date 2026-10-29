import { Injectable } from '@nestjs/common';
import type {
  CheckinReminderSubject,
  SubscriptionReminderSubject,
} from './interfaces/reminder.interface';
import { CheckinReminderCancellationOrchestrator } from './orchestration/checkin-reminder-cancellation.orchestrator';
import { CheckinReminderSchedulingOrchestrator } from './orchestration/checkin-reminder-scheduling.orchestrator';
import { ReminderCancellationOrchestrator } from './orchestration/reminder-cancellation.orchestrator';
import { ReminderDispatchOrchestrator } from './orchestration/reminder-dispatch.orchestrator';
import { ReminderSchedulingOrchestrator } from './orchestration/reminder-scheduling.orchestrator';

/** The reminders module's interface: telling clients that their subscription is ending. */
@Injectable()
export class RemindersService {
  constructor(
    private readonly scheduling: ReminderSchedulingOrchestrator,
    private readonly cancellation: ReminderCancellationOrchestrator,
    private readonly dispatch: ReminderDispatchOrchestrator,
    private readonly checkinScheduling: CheckinReminderSchedulingOrchestrator,
    private readonly checkinCancellation: CheckinReminderCancellationOrchestrator,
  ) {}

  /** Plans the reminders for a subscription's end date, replacing any not yet sent. */
  schedule(
    workspaceId: string,
    subject: SubscriptionReminderSubject,
  ): Promise<void> {
    return this.scheduling.execute(workspaceId, subject);
  }

  /** Drops the reminders of a subscription that has not gone out. */
  cancel(workspaceId: string, subscriptionId: string): Promise<void> {
    return this.cancellation.execute(workspaceId, subscriptionId);
  }

  /** Plans the link to each check-in going out to the client at the chosen hour on its day. */
  scheduleCheckins(
    workspaceId: string,
    subjects: CheckinReminderSubject[],
  ): Promise<void> {
    return this.checkinScheduling.execute(workspaceId, subjects);
  }

  /** Drops the links of check-ins that are no longer asked for and have not gone out. */
  cancelCheckins(workspaceId: string, checkinIds: string[]): Promise<void> {
    return this.checkinCancellation.execute(workspaceId, checkinIds);
  }

  /** Delivers what is due, for the background job. Returns how many were delivered. */
  dispatchDue(): Promise<number> {
    return this.dispatch.execute();
  }
}
