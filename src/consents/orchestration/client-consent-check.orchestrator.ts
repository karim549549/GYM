import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import type { ClientConsentType } from '../enums/client-consent-type.enum';
import { ConsentsQueryHandler } from '../handlers/consents-query.handler';
import { ConsentStatePolicy } from '../policies/consent-state.policy';
import { BaseClientConsentOrchestrator } from './base-client-consent.orchestrator';

/**
 * Takes over `ConsentsService.isGranted`: whether a client has agreed to all of these right now.
 * Never throws, for the callers that quietly do less (the sender of reminders, a redacted answer).
 */
@Injectable()
export class ClientConsentCheckOrchestrator extends BaseClientConsentOrchestrator {
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
  ): Promise<boolean> {
    return this.transactions.run(
      async () => {
        const granted = await this.grantedTypes(clientId);
        return types.every((type) => granted.includes(type));
      },
      { workspaceId },
    );
  }
}
