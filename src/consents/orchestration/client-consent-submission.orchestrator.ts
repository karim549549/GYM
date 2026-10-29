import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import type { ClientConsentType } from '../enums/client-consent-type.enum';
import type { ConsentSource } from '../enums/consent-source.enum';
import { ConsentRequiredException } from '../exceptions/consent-exceptions';
import { ConsentsQueryHandler } from '../handlers/consents-query.handler';
import type { ConsentChange } from '../interfaces/consent.interface';
import { ClientConsentRequirementPolicy } from '../policies/client-consent-requirement.policy';
import { ConsentStatePolicy } from '../policies/consent-state.policy';
import { BaseClientConsentOrchestrator } from './base-client-consent.orchestrator';

/**
 * Takes over `ConsentsService.submitForClient`: the consents a client ticks on a form. The required
 * ones must all be granted or nothing is recorded, so a form cannot be handed in without them.
 */
@Injectable()
export class ClientConsentSubmissionOrchestrator extends BaseClientConsentOrchestrator {
  constructor(
    consentsQuery: ConsentsQueryHandler,
    statePolicy: ConsentStatePolicy,
    transactions: TransactionManager,
    private readonly requirementPolicy: ClientConsentRequirementPolicy,
  ) {
    super(consentsQuery, statePolicy, transactions);
  }

  execute(
    workspaceId: string,
    clientId: string,
    submitted: ConsentChange<ClientConsentType>[],
    source: ConsentSource,
  ): Promise<void> {
    const decision = this.requirementPolicy.check(submitted);
    if (decision.outcome === 'missing') {
      throw new ConsentRequiredException(decision.missing);
    }
    return this.transactions.run(
      () => this.record(workspaceId, clientId, submitted, source),
      { workspaceId },
    );
  }
}
