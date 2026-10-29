import { Injectable } from '@nestjs/common';

export type IntakeLinkStatus =
  { outcome: 'open' } | { outcome: 'expired' } | { outcome: 'submitted' };

/** Whether an intake link can still be used. A link closes on its first submission or after 14 days. */
@Injectable()
export class IntakeLinkPolicy {
  static readonly VALID_DAYS = 14;

  statusOf(
    link: { expiresAt: Date; submittedAt: Date | null },
    now: Date,
  ): IntakeLinkStatus {
    if (link.submittedAt) {
      return { outcome: 'submitted' };
    }
    return link.expiresAt.getTime() <= now.getTime()
      ? { outcome: 'expired' }
      : { outcome: 'open' };
  }
}
