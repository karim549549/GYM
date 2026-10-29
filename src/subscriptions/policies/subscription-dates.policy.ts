import { Injectable } from '@nestjs/common';

/**
 * How dates work for subscriptions. A date here is a calendar day as `YYYY-MM-DD`, with no
 * time and no zone, because a subscription runs by the day. The day is Egypt's: a coach who
 * adds a client after midnight at home means today, not yesterday in UTC.
 */
@Injectable()
export class SubscriptionDatesPolicy {
  private static readonly TIME_ZONE = 'Africa/Cairo';
  private static readonly DAY_MS = 86_400_000;

  /** The date in Egypt as YYYY-MM-DD (the Canadian format happens to be that). */
  today(now: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: SubscriptionDatesPolicy.TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }

  addDays(date: string, days: number): string {
    const moved = new Date(
      this.toMs(date) + days * SubscriptionDatesPolicy.DAY_MS,
    );
    return moved.toISOString().slice(0, 10);
  }

  /** Whole days from `from` to `to`; negative when `to` is earlier. */
  daysBetween(from: string, to: string): number {
    return Math.round(
      (this.toMs(to) - this.toMs(from)) / SubscriptionDatesPolicy.DAY_MS,
    );
  }

  /** The last day a package covers: the first day counts, so 30 days from the 1st end on the 30th. */
  endOfPackage(startsOn: string, durationDays: number): string {
    return this.addDays(startsOn, durationDays - 1);
  }

  /** The month `date` is in, from its first day to its last. */
  monthOf(date: string): { from: string; to: string } {
    const [year, month] = date.split('-').map(Number);
    const next = month === 12 ? [year + 1, 1] : [year, month + 1];
    return {
      from: `${year}-${String(month).padStart(2, '0')}-01`,
      to: this.addDays(`${next[0]}-${String(next[1]).padStart(2, '0')}-01`, -1),
    };
  }

  /** The moment the clock in Egypt shows `hour` on that day, whatever the season's offset from UTC. */
  atHour(date: string, hour: number): Date {
    const guess = this.toMs(date) + hour * 3_600_000;
    return new Date(guess - this.offsetMs(guess));
  }

  /** How far Egypt's clock is ahead of UTC at that instant. */
  private offsetMs(instant: number): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: SubscriptionDatesPolicy.TIME_ZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).formatToParts(new Date(instant));
    const part = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value);
    const local = Date.UTC(
      part('year'),
      part('month') - 1,
      part('day'),
      part('hour'),
      part('minute'),
      part('second'),
    );
    return local - instant;
  }

  private toMs(date: string): number {
    return Date.parse(`${date}T00:00:00Z`);
  }
}
