import { Injectable } from '@nestjs/common';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import type { MonthWindow } from '../interfaces/analytics.interface';

/**
 * The arithmetic behind a coach's business view: the months it covers, the day each is measured on,
 * and shares and averages that say nothing rather than divide by zero.
 */
@Injectable()
export class BusinessAnalyticsPolicy {
  constructor(private readonly dates: SubscriptionDatesPolicy) {}

  /** The last `count` months up to and including the one `today` is in, oldest first. */
  lastMonths(today: string, count: number): MonthWindow[] {
    const [year, month] = today.split('-').map(Number);
    const windows: MonthWindow[] = [];
    for (let back = count - 1; back >= 0; back -= 1) {
      const index = year * 12 + (month - 1) - back;
      const first = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`;
      const { from, to } = this.dates.monthOf(first);
      windows.push({ month: from.slice(0, 7), from, to });
    }
    return windows;
  }

  /** The day a month's head count is taken: its last day, or today while it is still running. */
  measuringDay(window: MonthWindow, today: string): string {
    return window.to < today ? window.to : today;
  }

  /** A share in percent to one decimal, or nothing when there is nothing it is a share of. */
  percent(part: number, whole: number): number | null {
    return whole === 0 ? null : Math.round((part / whole) * 1000) / 10;
  }

  /** The total over the count as a whole number, or nothing when there is nothing to average. */
  average(total: number, count: number): number | null {
    return count === 0 ? null : Math.round(total / count);
  }
}
