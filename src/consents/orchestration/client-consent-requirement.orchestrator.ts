import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import type { ClientConsentType } from '../enums/client-consent-type.enum';
import { ClientConsentRequiredException } from '../exceptions/consent-exceptions';
import { ConsentsQueryHandler } from '../handlers/consents-query.handler';
import { ConsentStatePolicy } from '../policies/consent-state.policy';
import { BaseClientConsentOrchestrator } from './base-client-consent.orchestrator';

/**
 * Takes over `ConsentsService.require`: refuses unless the client has agreed to all of these.
 * For what must not happen without them: reading a client's health data, accepting a check-in.
 */
@Injectable()
export class ClientConsentRequirementOrchestrator extends BaseClientConsentOrchestrator {
  constructor(
    consentsQuery: ConsentsQueryHandler,
    statePolicy: ConsentStatePolicy,
    transactions: TransactionManager,
  ) {
    super(consentsQuery, statePolicy, transactions);
  }

  execute(
    workspaceId: string,
    clientId: string,
    types: ClientConsentType[],
  ): Promise<void> {
    return this.transactions.run(
      async () => {
        const granted = await this.grantedTypes(clientId);
        const missing = types.filter((type) => !granted.includes(type));
        if (missing.length > 0) {
          throw new ClientConsentRequiredException(missing);
        }
      },
      { workspaceId },
    );
  }
}
