import { Injectable } from '@nestjs/common';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import type {
  Adherence,
  CheckinSummary,
  SeriesPoint,
  WeightProgress,
} from '../interfaces/analytics.interface';

/**
 * What a client's numbers say, for the page that makes them feel progress so they renew: the change
 * and the pace of their weight, how closely they followed their plans, and how long they have been
 * at it. Pure arithmetic on what was recorded; nothing here is stored.
 */
@Injectable()
export class ClientProgressPolicy {
  private static readonly WINDOW_DAYS = 28;
  private static readonly DAYS_A_WEEK = 7;

  constructor(private readonly dates: SubscriptionDatesPolicy) {}

  weight(
    unit: string | null,
    points: SeriesPoint[],
    target: number | null,
    today: string,
  ): WeightProgress {
    const first = points[0] ?? null;
    const latest = points[points.length - 1] ?? null;
    return {
      unit,
      points,
      target,
      first,
      latest,
      change: first && latest ? this.round(latest.value - first.value) : null,
      weeklyRate: this.weeklyRate(points, today),
    };
  }

  adherence(checkins: CheckinSummary[]): Adherence {
    if (checkins.length === 0) {
      return { nutritionPct: null, trainingPct: null, checkinRatePct: null };
    }
    const handedIn = checkins.filter((checkin) => checkin.submittedAt);
    return {
      nutritionPct: this.daysPct(handedIn, 'nutritionDays'),
      trainingPct: this.daysPct(handedIn, 'trainingDays'),
      checkinRatePct: this.percent(handedIn.length, checkins.length),
    };
  }

  /** Whole weeks since the first subscription began, never negative. */
  weeksCompleted(firstStart: string | null, today: string): number | null {
    if (firstStart === null) {
      return null;
    }
    return Math.max(
      0,
      Math.floor(
        this.dates.daysBetween(firstStart, today) /
          ClientProgressPolicy.DAYS_A_WEEK,
      ),
    );
  }

  /** Units a week, from the first reading of the last four weeks to the last. */
  private weeklyRate(points: SeriesPoint[], today: string): number | null {
    const since = this.dates.addDays(today, -ClientProgressPolicy.WINDOW_DAYS);
    const recent = points.filter((point) => point.date >= since);
    if (recent.length < 2) {
      return null;
    }
    const first = recent[0];
    const last = recent[recent.length - 1];
    const weeks =
      this.dates.daysBetween(first.date, last.date) /
      ClientProgressPolicy.DAYS_A_WEEK;
    return weeks === 0 ? null : this.round((last.value - first.value) / weeks);
  }

  private daysPct(
    handedIn: CheckinSummary[],
    question: 'nutritionDays' | 'trainingDays',
  ): number | null {
    const days = handedIn
      .map((checkin) => checkin.answers?.[question])
      .filter((value): value is number => typeof value === 'number');
    if (days.length === 0) {
      return null;
    }
    const total = days.reduce((sum, value) => sum + value, 0);
    return this.percent(total, days.length * ClientProgressPolicy.DAYS_A_WEEK);
  }

  private percent(part: number, whole: number): number {
    return Math.round((part / whole) * 1000) / 10;
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
