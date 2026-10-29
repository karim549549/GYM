import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import type { ConsentSource } from '../enums/consent-source.enum';
import { ConsentStatus } from '../enums/consent-status.enum';
import type { PersonConsentType } from '../enums/person-consent-type.enum';
import { ConsentsQueryHandler } from '../handlers/consents-query.handler';
import type { ConsentChange } from '../interfaces/consent.interface';
import { ConsentStatePolicy } from '../policies/consent-state.policy';
import { ConsentTextsPolicy } from '../policies/consent-texts.policy';

/**
 * Takes over `ConsentsService.recordForPerson`: an account holder agreeing at signup or changing a
 * choice later. As for clients, a row is added only when it changes where the consent stands.
 */
@Injectable()
export class PersonConsentRecordingOrchestrator {
  constructor(
    private readonly consentsQuery: ConsentsQueryHandler,
    private readonly statePolicy: ConsentStatePolicy,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    personId: string,
    changes: ConsentChange<PersonConsentType>[],
    source: ConsentSource,
  ): Promise<void> {
    return this.transactions.run(async () => {
      const newest = await this.consentsQuery.newestForPerson(personId);
      const rows = changes
        .filter((change) => {
          const status = this.statePolicy.statusOf(
            newest.find((r) => r.type === change.type) ?? null,
          ).outcome;
          return change.granted
            ? status !== ConsentStatus.GRANTED
            : status === ConsentStatus.GRANTED;
        })
        .map((change) => ({
          type: change.type,
          granted: change.granted,
          textVersion: ConsentTextsPolicy.VERSION,
          source,
        }));
      await this.consentsQuery.addForPerson(personId, rows);
    });
  }
}
