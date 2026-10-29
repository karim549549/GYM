import { Injectable } from '@nestjs/common';
import { CheckinStatus } from '../enums/checkin-status.enum';

export interface CheckinStateInput {
  dueOn: string;
  submittedAt: Date | null;
  /** Today in Egypt, YYYY-MM-DD. */
  today: string;
}

export type CheckinAccess = {
  outcome: 'open' | 'not_yet' | 'expired' | 'submitted';
};

/**
 * Where a check-in stands. YYYY-MM-DD dates compare correctly as text, so no date arithmetic is
 * needed here: "later than" is simply "sorts after".
 */
@Injectable()
export class CheckinStatePolicy {
  /** A link keeps working for 14 days from its day, so a client who forgot can still answer. */
  private static readonly OPEN_DAYS = 14;

  /** What the coach sees. */
  statusOf(input: CheckinStateInput): CheckinStatus {
    if (input.submittedAt) {
      return CheckinStatus.SUBMITTED;
    }
    return input.dueOn < input.today
      ? CheckinStatus.MISSED
      : CheckinStatus.PENDING;
  }

  /** What the client opening the link may do. */
  accessOf(input: CheckinStateInput): CheckinAccess {
    if (input.submittedAt) {
      return { outcome: 'submitted' };
    }
    if (input.today < input.dueOn) {
      return { outcome: 'not_yet' };
    }
    return {
      outcome:
        this.daysSince(input) < CheckinStatePolicy.OPEN_DAYS
          ? 'open'
          : 'expired',
    };
  }

  private daysSince(input: CheckinStateInput): number {
    return Math.round(
      (Date.parse(`${input.today}T00:00:00Z`) -
        Date.parse(`${input.dueOn}T00:00:00Z`)) /
        86_400_000,
    );
  }
}
