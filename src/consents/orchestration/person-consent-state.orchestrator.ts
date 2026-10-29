import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PersonConsentType } from '../enums/person-consent-type.enum';
import { ConsentsQueryHandler } from '../handlers/consents-query.handler';
import type { ConsentState } from '../interfaces/consent.interface';
import { ConsentStatePolicy } from '../policies/consent-state.policy';

/** Takes over `ConsentsService.personStates`: where each of an account holder's consents stands. */
@Injectable()
export class PersonConsentStateOrchestrator {
  constructor(
    private readonly consentsQuery: ConsentsQueryHandler,
    private readonly statePolicy: ConsentStatePolicy,
    private readonly transactions: TransactionManager,
  ) {}

  execute(personId: string): Promise<ConsentState[]> {
    return this.transactions.run(async () => {
      const newest = await this.consentsQuery.newestForPerson(personId);
      return Object.values(PersonConsentType).map((type) => {
        const row = newest.find((r) => r.type === type) ?? null;
        return {
          type,
          status: this.statePolicy.statusOf(row).outcome,
          changedAt: row?.recordedAt ?? null,
          source: row?.source ?? null,
          textVersion: row?.textVersion ?? null,
        };
      });
    });
  }
}
