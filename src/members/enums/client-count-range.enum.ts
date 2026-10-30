/** How many clients a coach has now, as the sign-up profile asks it. It sizes the plan and teaches us the market. */
export enum ClientCountRange {
  UNDER_5 = 'lt5',
  FROM_5_TO_20 = 'r5_20',
  FROM_20_TO_50 = 'r20_50',
  OVER_50 = 'gt50',
}
