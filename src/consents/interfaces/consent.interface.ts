import type { ConsentSource } from '../enums/consent-source.enum';
import type { ConsentStatus } from '../enums/consent-status.enum';

/** The wording shown to the person, with the version it was shown as. */
export interface ConsentText {
  type: string;
  version: string;
  /** A required consent must be granted before the thing it covers can happen. */
  required: boolean;
  textAr: string;
  textEn: string;
}

/** Where one consent stands now. */
export interface ConsentState {
  type: string;
  status: ConsentStatus;
  changedAt: Date | null;
  source: ConsentSource | null;
  textVersion: string | null;
}

export interface ConsentChange<T extends string> {
  type: T;
  granted: boolean;
}

/** One row of the ledger as read back. */
export interface StoredConsent {
  type: string;
  granted: boolean;
  textVersion: string;
  source: ConsentSource;
  recordedAt: Date;
}
