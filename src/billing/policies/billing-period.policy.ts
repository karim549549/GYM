import { Injectable } from '@nestjs/common';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { BillingInterval } from '../enums/billing-interval.enum';
import type { BillingPeriod } from '../interfaces/billing.interface';

/**
 * How long a payment to the platform covers. A period starts on a date and ends the day before the
 * same date a month (or a year) later; a month that is too short ends the period at its last day,
 * never spilling into the next one.
 */
@Injectable()
export class BillingPeriodPolicy {
  constructor(private readonly dates: SubscriptionDatesPolicy) {}

  periodFrom(start: string, interval: BillingInterval): BillingPeriod {
    const months = interval === BillingInterval.YEAR ? 12 : 1;
    return {
      start,
      end: this.dates.addDays(this.addMonths(start, months), -1),
    };
  }

  /**
   * The period a payment buys. When the coach pays before the running one ends it continues the day
   * after, so paying early loses no days; otherwise it starts today.
   */
  nextPeriod(input: {
    today: string;
    interval: BillingInterval;
    /** The last day of the period still running, if there is one. */
    runningUntil: string | null;
  }): BillingPeriod {
    const continues =
      input.runningUntil !== null &&
      this.dates.daysBetween(input.today, input.runningUntil) >= 0;
    const start = continues
      ? this.dates.addDays(input.runningUntil as string, 1)
      : input.today;
    return this.periodFrom(start, input.interval);
  }

  /** The same day of the month `months` later, or the last day of that month if it has no such day. */
  private addMonths(date: string, months: number): string {
    const [year, month, day] = date.split('-').map(Number);
    const index = year * 12 + (month - 1) + months;
    const targetYear = Math.floor(index / 12);
    const targetMonth = (index % 12) + 1;
    const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(
      Math.min(day, lastDay),
    ).padStart(2, '0')}`;
  }
}
