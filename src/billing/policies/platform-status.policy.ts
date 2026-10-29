import { Injectable } from '@nestjs/common';
import { PlatformSubscriptionStatus } from '../enums/platform-subscription-status.enum';

/**
 * Where a coach stands with the platform today. Past due is worked out from the date, never stored,
 * for the same reason a client's "expiring soon" is not: it would be wrong again tomorrow.
 */
@Injectable()
export class PlatformStatusPolicy {
  statusOf(input: {
    status: PlatformSubscriptionStatus;
    currentPeriodEnd: string;
    priceMinor: number;
    /** Today in Egypt, YYYY-MM-DD. */
    today: string;
  }): PlatformSubscriptionStatus {
    const overdue =
      input.status === PlatformSubscriptionStatus.ACTIVE &&
      input.priceMinor > 0 &&
      input.currentPeriodEnd < input.today;
    return overdue ? PlatformSubscriptionStatus.PAST_DUE : input.status;
  }
}
