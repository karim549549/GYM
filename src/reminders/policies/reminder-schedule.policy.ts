import { Injectable } from '@nestjs/common';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { ReminderAudience } from '../enums/reminder-audience.enum';
import { ReminderKind } from '../enums/reminder-kind.enum';

export interface PlannedReminder {
  kind: ReminderKind;
  audience: ReminderAudience;
  scheduledFor: Date;
}

/**
 * When a client hears about their subscription ending: three days before, and on the end date
 * itself, at ten in the morning in Egypt, an hour a person is awake and not in the gym. The
 * coach's own alerts are not here: the coach reads those on their home screen.
 */
@Injectable()
export class ReminderSchedulePolicy {
  private static readonly SEND_HOUR = 10;
  private static readonly WARNING_DAYS = 3;

  constructor(private readonly dates: SubscriptionDatesPolicy) {}

  /** What is still to be sent for a subscription ending on `endsOn`, leaving out what is already past. */
  forSubscription(endsOn: string, now: Date): PlannedReminder[] {
    const planned: PlannedReminder[] = [
      {
        kind: ReminderKind.EXPIRING_SOON,
        audience: ReminderAudience.CLIENT,
        scheduledFor: this.at(
          this.dates.addDays(endsOn, -ReminderSchedulePolicy.WARNING_DAYS),
        ),
      },
      {
        kind: ReminderKind.EXPIRED,
        audience: ReminderAudience.CLIENT,
        scheduledFor: this.at(endsOn),
      },
    ];
    return planned.filter((reminder) => reminder.scheduledFor > now);
  }

  /** When the link goes out: the chosen hour on the due day, or right away if that hour has passed. */
  forCheckin(dueOn: string, sendHour: number, now: Date): Date {
    const planned = this.dates.atHour(dueOn, sendHour);
    return planned > now ? planned : now;
  }

  private at(date: string): Date {
    return this.dates.atHour(date, ReminderSchedulePolicy.SEND_HOUR);
  }
}
