import { Injectable } from '@nestjs/common';
import { InvitationState } from '../enums/invitation-state.enum';
import { InvitationStatus } from '../enums/invitation-status.enum';

/** What an invitation is now. That it ran out is worked out from its expiry date, so no job has to mark it. */
@Injectable()
export class InvitationStatePolicy {
  stateOf(
    invitation: { status: InvitationStatus; expiresAt: Date },
    now: Date,
  ): { outcome: InvitationState } {
    if (invitation.status !== InvitationStatus.PENDING) {
      return { outcome: invitation.status as unknown as InvitationState };
    }
    return {
      outcome:
        invitation.expiresAt.getTime() > now.getTime()
          ? InvitationState.PENDING
          : InvitationState.EXPIRED,
    };
  }
}
