/** What an invitation is now, as the person reading it sees it. */
export enum InvitationState {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}
