/** How a coach paid the platform. Money moves outside the system: the invoice only records that it did. */
export enum InvoicePaymentMethod {
  INSTAPAY = 'instapay',
  WALLET = 'wallet',
  CASH = 'cash',
  BANK = 'bank',
  OTHER = 'other',
}
