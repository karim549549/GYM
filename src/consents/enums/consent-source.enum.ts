/** Where a choice was made, kept as evidence. */
export enum ConsentSource {
  SIGNUP = 'signup',
  ACCOUNT = 'account',
  INTAKE_LINK = 'intake_link',
  CHECKIN_LINK = 'checkin_link',
  /** A coach recording that a client told them they withdraw. Never used to give consent. */
  COACH_ON_BEHALF = 'coach_on_behalf',
}
