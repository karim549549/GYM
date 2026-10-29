/** Where a consent stands now, worked out from the ledger. `none` means never asked or answered. */
export enum ConsentStatus {
  GRANTED = 'granted',
  WITHDRAWN = 'withdrawn',
  NONE = 'none',
}
