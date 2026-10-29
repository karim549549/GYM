/** Where a workout plan stands. A client has at most one active plan. */
export enum PlanStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ENDED = 'ended',
}
