/** Where a check-in stands today. Worked out from the dates and the submission, never stored. */
export enum CheckinStatus {
  /** Not handed in, and its day has not passed. */
  PENDING = 'pending',
  /** Not handed in, and its day has passed: what makes a client "gone quiet". */
  MISSED = 'missed',
  SUBMITTED = 'submitted',
}
