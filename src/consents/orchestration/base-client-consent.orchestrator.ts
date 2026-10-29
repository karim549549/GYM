import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { ClientConsentType } from '../enums/client-consent-type.enum';
import type { ConsentSource } from '../enums/consent-source.enum';
import { ConsentStatus } from '../enums/consent-status.enum';
import { ConsentsQueryHandler } from '../handlers/consents-query.handler';
import type {
  ConsentChange,
  ConsentState,
} from '../interfaces/consent.interface';
import { ConsentStatePolicy } from '../policies/consent-state.policy';
import { ConsentTextsPolicy } from '../policies/consent-texts.policy';

/** What the orchestrators that work on a client's consents share: reading where each stands, and recording a change. */
@Injectable()
export abstract class BaseClientConsentOrchestrator {
  constructor(
    protected readonly consentsQuery: ConsentsQueryHandler,
    protected readonly statePolicy: ConsentStatePolicy,
    protected readonly transactions: TransactionManager,
  ) {}

  /** One state per type there is, in the order of the enum. */
  protected async statesOf(clientId: string): Promise<ConsentState[]> {
    const newest = await this.consentsQuery.newestForClient(clientId);
    return Object.values(ClientConsentType).map((type) => {
      const row = newest.find((r) => r.type === type) ?? null;
      return {
        type,
        status: this.statePolicy.statusOf(row).outcome,
        changedAt: row?.recordedAt ?? null,
        source: row?.source ?? null,
        textVersion: row?.textVersion ?? null,
      };
    });
  }

  protected async grantedTypes(clientId: string): Promise<ClientConsentType[]> {
    const states = await this.statesOf(clientId);
    return states
      .filter((state) => state.status === ConsentStatus.GRANTED)
      .map((state) => state.type as ClientConsentType);
  }

  /** Adds a row for each change that actually changes where the consent stands. */
  protected async record(
    workspaceId: string,
    clientId: string,
    changes: ConsentChange<ClientConsentType>[],
    source: ConsentSource,
  ): Promise<void> {
    const before = await this.statesOf(clientId);
    const rows = changes
      .filter((change) => {
        const current = before.find((s) => s.type === change.type)!;
        return change.granted
          ? current.status !== ConsentStatus.GRANTED
          : current.status === ConsentStatus.GRANTED;
      })
      .map((change) => ({
        type: change.type,
        granted: change.granted,
        textVersion: ConsentTextsPolicy.VERSION,
        source,
      }));
    await this.consentsQuery.addForClient(workspaceId, clientId, rows);
  }
}
