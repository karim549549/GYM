import { Injectable } from '@nestjs/common';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { CheckinFrequency } from '../enums/checkin-frequency.enum';

export interface CheckinCadence {
  frequency: CheckinFrequency;
  dayOfWeek: number | null;
}

/**
 * On which days a client is asked to check in. The days are worked out ahead of time and kept as
 * rows, so what follows from them (a miss, the adherence rate) is counted rather than guessed.
 */
@Injectable()
export class CheckinSchedulePolicy {
  /** Friday is the product's default weekly day. Sunday is 0. */
  private static readonly DEFAULT_DAY = 5;

  private static readonly STEP_DAYS: Record<CheckinFrequency, number> = {
    [CheckinFrequency.DAILY]: 1,
    [CheckinFrequency.EVERY_2_DAYS]: 2,
    [CheckinFrequency.WEEKLY]: 7,
    [CheckinFrequency.FORTNIGHTLY]: 14,
  };

  constructor(private readonly dates: SubscriptionDatesPolicy) {}

  /** The weekday worth keeping: only a weekly or fortnightly check-in has one. */
  dayOfWeekFor(
    frequency: CheckinFrequency,
    chosen: number | undefined,
  ): number | null {
    if (
      frequency !== CheckinFrequency.WEEKLY &&
      frequency !== CheckinFrequency.FORTNIGHTLY
    ) {
      return null;
    }
    return chosen ?? CheckinSchedulePolicy.DEFAULT_DAY;
  }

  /** Every due day from `from` (included) to `to` (included), on the chosen weekday where there is one. */
  dueDatesFrom(cadence: CheckinCadence, from: string, to: string): string[] {
    return this.walk(this.firstOnOrAfter(cadence, from), cadence, to);
  }

  /** The due days after `last` to `to`, by the same step, so a fortnightly rhythm never shifts. */
  dueDatesAfter(cadence: CheckinCadence, last: string, to: string): string[] {
    return this.walk(
      this.dates.addDays(
        last,
        CheckinSchedulePolicy.STEP_DAYS[cadence.frequency],
      ),
      cadence,
      to,
    );
  }

  private firstOnOrAfter(cadence: CheckinCadence, from: string): string {
    const day = this.dayOfWeekFor(
      cadence.frequency,
      cadence.dayOfWeek ?? undefined,
    );
    if (day === null) {
      return from;
    }
    const weekday = new Date(`${from}T00:00:00Z`).getUTCDay();
    return this.dates.addDays(from, (day - weekday + 7) % 7);
  }

  private walk(first: string, cadence: CheckinCadence, to: string): string[] {
    const step = CheckinSchedulePolicy.STEP_DAYS[cadence.frequency];
    const days: string[] = [];
    for (
      let day = first;
      this.dates.daysBetween(day, to) >= 0;
      day = this.dates.addDays(day, step)
    ) {
      days.push(day);
    }
    return days;
  }
}
