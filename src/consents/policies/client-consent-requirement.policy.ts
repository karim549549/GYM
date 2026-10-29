import { Injectable } from '@nestjs/common';
import { ClientConsentType } from '../enums/client-consent-type.enum';
import type { ConsentChange } from '../interfaces/consent.interface';

export type ClientConsentRequirementDecision =
  { outcome: 'ok' } | { outcome: 'missing'; missing: ClientConsentType[] };

/** What a client must agree to before handing in their details: the two that cover the data itself. */
@Injectable()
export class ClientConsentRequirementPolicy {
  static readonly REQUIRED = [
    ClientConsentType.DATA_PROCESSING,
    ClientConsentType.HEALTH_DATA,
  ];

  check(
    submitted: ConsentChange<ClientConsentType>[],
  ): ClientConsentRequirementDecision {
    const missing = ClientConsentRequirementPolicy.REQUIRED.filter(
      (type) => !submitted.some((c) => c.type === type && c.granted),
    );
    return missing.length === 0
      ? { outcome: 'ok' }
      : { outcome: 'missing', missing };
  }
}
