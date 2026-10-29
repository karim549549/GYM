import { Injectable } from '@nestjs/common';
import { ConsentStatus } from '../enums/consent-status.enum';

/** Reads the ledger: the newest row for a type is the answer, and no row is not the same as a refusal. */
@Injectable()
export class ConsentStatePolicy {
  statusOf(newest: { granted: boolean } | null): { outcome: ConsentStatus } {
    if (!newest) {
      return { outcome: ConsentStatus.NONE };
    }
    return {
      outcome: newest.granted ? ConsentStatus.GRANTED : ConsentStatus.WITHDRAWN,
    };
  }
}
