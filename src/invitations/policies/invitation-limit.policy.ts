import { Injectable } from '@nestjs/common';

/** How long an invitation stays open, and how many a workspace may have open at once. */
@Injectable()
export class InvitationLimitPolicy {
  static readonly TTL_DAYS = 14;
  static readonly MAX_OPEN = 20;

  check(open: number): { outcome: 'allowed' | 'limit_reached' } {
    return {
      outcome:
        open >= InvitationLimitPolicy.MAX_OPEN ? 'limit_reached' : 'allowed',
    };
  }
}
