/** Where a client is in handing over their details. */
export enum IntakeStatus {
  /** The coach added them; the form has not come back yet. */
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  /** The coach chose not to ask. */
  SKIPPED = 'skipped',
}
