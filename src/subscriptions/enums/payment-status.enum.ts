/** How much of the price has been received. Computed from the payments, never stored. */
export enum PaymentStatus {
  UNPAID = 'unpaid',
  PARTIAL = 'partial',
  PAID = 'paid',
}
