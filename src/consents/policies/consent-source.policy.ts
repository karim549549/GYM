import { Injectable } from '@nestjs/common';
import { ConsentSource } from '../enums/consent-source.enum';
import type { ConsentChange } from '../interfaces/consent.interface';

/** Who may record what: a coach can note that a client withdrew, but only the client can agree. */
@Injectable()
export class ConsentSourcePolicy {
  check(
    source: ConsentSource,
    changes: ConsentChange<string>[],
  ): { outcome: 'allowed' | 'refused' } {
    const grantsOnBehalf =
      source === ConsentSource.COACH_ON_BEHALF &&
      changes.some((change) => change.granted);
    return { outcome: grantsOnBehalf ? 'refused' : 'allowed' };
  }
}
