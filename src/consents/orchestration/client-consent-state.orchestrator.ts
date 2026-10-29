import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { TransactionManager } from '../../database/transaction.manager';
import { ConsentsQueryHandler } from '../handlers/consents-query.handler';
import type { ConsentState } from '../interfaces/consent.interface';
import { ConsentStatePolicy } from '../policies/consent-state.policy';
import { BaseClientConsentOrchestrator } from './base-client-consent.orchestrator';

/** Takes over `ConsentsService.clientStates`: where each of a client's consents stands. */
@Injectable()
export class ClientConsentStateOrchestrator extends BaseClientConsentOrchestrator {
  constructor(
    consentsQuery: ConsentsQueryHandler,
    statePolicy: ConsentStatePolicy,
    transactions: TransactionManager,
    private readonly clients: ClientsService,
  ) {
    super(consentsQuery, statePolicy, transactions);
  }

  execute(workspaceId: string, clientId: string): Promise<ConsentState[]> {
    return this.transactions.run(
      async () => {
        await this.clients.findOne(workspaceId, clientId);
        return this.statesOf(clientId);
      },
      { workspaceId },
    );
  }
}
