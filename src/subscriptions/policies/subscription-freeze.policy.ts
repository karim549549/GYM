import { Injectable } from '@nestjs/common';
import { SubscriptionDatesPolicy } from './subscription-dates.policy';

export type ResumeDecision =
  | { outcome: 'resume'; daysFrozen: number; endsOn: string }
  | { outcome: 'before_freeze' };

/**
 * What resuming a frozen subscription does. The days spent frozen are given back, so a client
 * who travelled for ten days still gets the whole of what they paid for.
 */
@Injectable()
export class SubscriptionFreezePolicy {
  constructor(private readonly dates: SubscriptionDatesPolicy) {}

  resume(input: {
    frozenOn: string;
    resumedOn: string;
    endsOn: string;
  }): ResumeDecision {
    const daysFrozen = this.dates.daysBetween(input.frozenOn, input.resumedOn);
    if (daysFrozen < 0) {
      return { outcome: 'before_freeze' };
    }
    return {
      outcome: 'resume',
      daysFrozen,
      endsOn: this.dates.addDays(input.endsOn, daysFrozen),
    };
  }
}
