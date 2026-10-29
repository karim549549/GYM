import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { ConsentsService } from '../../consents/consents.service';
import type { ConsentState } from '../../consents/interfaces/consent.interface';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { CheckinsQueryHandler } from '../handlers/checkins-query.handler';
import { CheckinStatePolicy } from '../policies/checkin-state.policy';
import { BasePublicCheckinOrchestrator } from './base-public-checkin.orchestrator';

/** Takes over `CheckinsService.consentStates`: where the client's choices stand, for the link they hold. */
@Injectable()
export class PublicCheckinConsentStatesOrchestrator extends BasePublicCheckinOrchestrator {
  constructor(
    checkinsQuery: CheckinsQueryHandler,
    statePolicy: CheckinStatePolicy,
    dates: SubscriptionDatesPolicy,
    clients: ClientsService,
    transactions: TransactionManager,
    private readonly consents: ConsentsService,
  ) {
    super(checkinsQuery, statePolicy, dates, clients, transactions);
  }

  async execute(token: string): Promise<ConsentState[]> {
    const { link } = await this.findLink(token);
    return this.consents.clientStates(link.workspaceId, link.clientId);
  }
}
