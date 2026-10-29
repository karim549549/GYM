import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { TransactionManager } from '../../database/transaction.manager';
import type { ClientConsentType } from '../enums/client-consent-type.enum';
import type { ConsentSource } from '../enums/consent-source.enum';
import { ConsentCannotBeGivenForClientException } from '../exceptions/consent-exceptions';
import { ConsentsQueryHandler } from '../handlers/consents-query.handler';
import type {
  ConsentChange,
  ConsentState,
} from '../interfaces/consent.interface';
import { ConsentSourcePolicy } from '../policies/consent-source.policy';
import { ConsentStatePolicy } from '../policies/consent-state.policy';
import { BaseClientConsentOrchestrator } from './base-client-consent.orchestrator';

/**
 * Takes over `ConsentsService.recordForClient`: a client agreeing or withdrawing, or a coach noting
 * a withdrawal. A row is added only when it changes where the consent stands, so the ledger reads
 * as a history of decisions and not a log of clicks.
 */
@Injectable()
export class ClientConsentRecordingOrchestrator extends BaseClientConsentOrchestrator {
  constructor(
    consentsQuery: ConsentsQueryHandler,
    statePolicy: ConsentStatePolicy,
    transactions: TransactionManager,
    private readonly sourcePolicy: ConsentSourcePolicy,
    private readonly clients: ClientsService,
  ) {
    super(consentsQuery, statePolicy, transactions);
  }

  execute(
    workspaceId: string,
    clientId: string,
    changes: ConsentChange<ClientConsentType>[],
    source: ConsentSource,
  ): Promise<ConsentState[]> {
    if (this.sourcePolicy.check(source, changes).outcome === 'refused') {
      throw new ConsentCannotBeGivenForClientException();
    }
    return this.transactions.run(
      async () => {
        await this.clients.findOne(workspaceId, clientId);
        await this.record(workspaceId, clientId, changes, source);
        return this.statesOf(clientId);
      },
      { workspaceId },
    );
  }
}
