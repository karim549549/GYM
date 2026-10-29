import { Injectable } from '@nestjs/common';
import { PaymentStatus } from '../enums/payment-status.enum';
import { SubscriptionState } from '../enums/subscription-state.enum';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { SubscriptionDatesPolicy } from './subscription-dates.policy';

export interface SubscriptionStateInput {
  status: SubscriptionStatus;
  endsOn: string;
  today: string;
  /** The workspace's "days before expiry to alert". */
  alertDays: number;
  /** What is still owed, in minor units. */
  dueMinor: number;
}

/**
 * The state a coach sees, worked out each time it is asked. Only the status is stored, because
 * "expiring soon" would be wrong again tomorrow and need a job to keep it right.
 */
@Injectable()
export class SubscriptionStatePolicy {
  constructor(private readonly dates: SubscriptionDatesPolicy) {}

  stateOf(input: SubscriptionStateInput): { outcome: SubscriptionState } {
    return { outcome: this.decide(input) };
  }

  paymentStatusOf(input: { priceMinor: number; paidMinor: number }): {
    outcome: PaymentStatus;
  } {
    if (input.paidMinor >= input.priceMinor) {
      return { outcome: PaymentStatus.PAID };
    }
    return {
      outcome:
        input.paidMinor > 0 ? PaymentStatus.PARTIAL : PaymentStatus.UNPAID,
    };
  }

  private decide(input: SubscriptionStateInput): SubscriptionState {
    switch (input.status) {
      case SubscriptionStatus.CANCELLED:
        return SubscriptionState.CANCELLED;
      case SubscriptionStatus.ENDED:
        return SubscriptionState.ENDED;
      case SubscriptionStatus.FROZEN:
        return SubscriptionState.FROZEN;
    }

    const daysLeft = this.dates.daysBetween(input.today, input.endsOn);
    if (daysLeft < 0) {
      return SubscriptionState.EXPIRED;
    }
    if (input.dueMinor > 0) {
      return SubscriptionState.PAYMENT_OVERDUE;
    }
    return daysLeft <= input.alertDays
      ? SubscriptionState.EXPIRING_SOON
      : SubscriptionState.ACTIVE;
  }
}
