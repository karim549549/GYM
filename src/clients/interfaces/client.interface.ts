import type { IntakeStatus } from '../enums/intake-status.enum';

export interface ClientRecord {
  id: string;
  fullName: string;
  /** International form, +20... */
  phone: string;
  intakeStatus: IntakeStatus;
  /** The person this client is, once they have signed up with that number. */
  personId: string | null;
  createdAt: Date;
}

export interface NewClient {
  fullName: string;
  phone: string;
}

/** What a coach may change. The link to a person follows the number and is set by us, not sent. */
export interface ClientChanges {
  fullName?: string;
  phone?: string;
  personId?: string | null;
}

export interface ClientListFilter {
  status?: IntakeStatus;
  search?: string;
}
