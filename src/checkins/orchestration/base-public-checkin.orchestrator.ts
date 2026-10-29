import { ClientsService } from '../../clients/clients.service';
import { ClientNotFoundException } from '../../clients/exceptions/client-exceptions';
import type { ClientRecord } from '../../clients/interfaces/client.interface';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import {
  CheckinAlreadySubmittedException,
  CheckinExpiredException,
  CheckinNotFoundException,
  CheckinNotOpenException,
} from '../exceptions/checkin-exceptions';
import { CheckinsQueryHandler } from '../handlers/checkins-query.handler';
import type { CheckinLinkTarget } from '../interfaces/checkin.interface';
import { CheckinStatePolicy } from '../policies/checkin-state.policy';

/**
 * What the two public flows (opening the form, handing it in) share: finding the check-in by the
 * secret in its link and refusing it unless it can be answered now. Nobody is signed in, so the
 * token is the only credential, and the lookup runs under it and nothing wider.
 */
export abstract class BasePublicCheckinOrchestrator {
  constructor(
    protected readonly checkinsQuery: CheckinsQueryHandler,
    protected readonly statePolicy: CheckinStatePolicy,
    protected readonly dates: SubscriptionDatesPolicy,
    protected readonly clients: ClientsService,
    protected readonly transactions: TransactionManager,
  ) {}

  /**
   * The check-in and its client by the secret, whatever state it is in. For what stays the client's
   * to do after the day has passed, such as changing what they agree to.
   */
  protected async findLink(
    token: string,
  ): Promise<{ link: CheckinLinkTarget; client: ClientRecord }> {
    const link = await this.transactions.run(
      () => this.checkinsQuery.findByToken(token),
      { checkinToken: token },
    );
    if (!link) {
      throw new CheckinNotFoundException();
    }

    return { link, client: await this.clientOf(link) };
  }

  protected async openLink(
    token: string,
  ): Promise<{ link: CheckinLinkTarget; client: ClientRecord }> {
    const found = await this.findLink(token);
    const { link } = found;

    const access = this.statePolicy.accessOf({
      dueOn: link.dueOn,
      submittedAt: link.submittedAt,
      today: this.dates.today(new Date()),
    });
    switch (access.outcome) {
      case 'not_yet':
        throw new CheckinNotOpenException();
      case 'expired':
        throw new CheckinExpiredException();
      case 'submitted':
        throw new CheckinAlreadySubmittedException();
    }

    return found;
  }

  /** A client who has since been removed has nothing to check in for: to the person with the link, there is none. */
  private async clientOf(link: CheckinLinkTarget): Promise<ClientRecord> {
    try {
      return await this.transactions.run(
        () => this.clients.findOne(link.workspaceId, link.clientId),
        { workspaceId: link.workspaceId },
      );
    } catch (error) {
      throw error instanceof ClientNotFoundException
        ? new CheckinNotFoundException()
        : error;
    }
  }
}
