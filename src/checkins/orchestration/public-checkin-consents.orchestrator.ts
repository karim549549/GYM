import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { ConsentsService } from '../../consents/consents.service';
import type { ClientConsentType } from '../../consents/enums/client-consent-type.enum';
import { ConsentSource } from '../../consents/enums/consent-source.enum';
import type { ConsentState } from '../../consents/interfaces/consent.interface';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { CheckinsQueryHandler } from '../handlers/checkins-query.handler';
import { CheckinStatePolicy } from '../policies/checkin-state.policy';
import { BasePublicCheckinOrchestrator } from './base-public-checkin.orchestrator';

/**
 * Takes over `CheckinsService.changeConsent`: the client agreeing or withdrawing from the link they
 * hold. It works in any state of the link, because taking back a consent must not depend on whether
 * a check-in is still open. The link's secret is the credential, as everywhere on the public side.
 */
@Injectable()
export class PublicCheckinConsentsOrchestrator extends BasePublicCheckinOrchestrator {
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

  async execute(
    token: string,
    type: ClientConsentType,
    granted: boolean,
  ): Promise<ConsentState[]> {
    const { link } = await this.findLink(token);
    return this.consents.recordForClient(
      link.workspaceId,
      link.clientId,
      [{ type, granted }],
      ConsentSource.CHECKIN_LINK,
    );
  }
}
