import { Injectable } from '@nestjs/common';
import type { ProgramLinkTarget } from '../interfaces/program-link.interface';

export type ProgramLockOutcome = { outcome: 'open' } | { outcome: 'locked' };

/**
 * How many wrong tries a program link takes before it stops listening for a while. The count is per link,
 * not per device, so guessing passwords from many places gets no more tries.
 */
@Injectable()
export class ProgramLockPolicy {
  static readonly LOCK_AFTER_FAILURES = 5;
  static readonly LOCK_MINUTES = 15;

  statusOf(
    link: Pick<ProgramLinkTarget, 'lockedUntil'>,
    now: Date,
  ): ProgramLockOutcome {
    return link.lockedUntil && link.lockedUntil.getTime() > now.getTime()
      ? { outcome: 'locked' }
      : { outcome: 'open' };
  }
}
