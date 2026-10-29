/** What was done with an invitation. That it ran out is worked out from its expiry date, never stored. */
export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  REVOKED = 'revoked',
}
