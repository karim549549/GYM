import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { ConsentsService } from '../../consents/consents.service';
import { TransactionManager } from '../../database/transaction.manager';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { FormPurpose } from '../../forms/enums/form-purpose.enum';
import { FormsService } from '../../forms/forms.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { CheckinsQueryHandler } from '../handlers/checkins-query.handler';
import type { PublicCheckinView } from '../interfaces/checkin.interface';
import { CheckinStatePolicy } from '../policies/checkin-state.policy';
import { BasePublicCheckinOrchestrator } from './base-public-checkin.orchestrator';

/** Takes over `CheckinsService.openForm`: what a client sees when they open their check-in link. */
@Injectable()
export class PublicCheckinFormOrchestrator extends BasePublicCheckinOrchestrator {
  constructor(
    checkinsQuery: CheckinsQueryHandler,
    statePolicy: CheckinStatePolicy,
    dates: SubscriptionDatesPolicy,
    clients: ClientsService,
    transactions: TransactionManager,
    private readonly workspaces: WorkspacesService,
    private readonly forms: FormsService,
    private readonly consents: ConsentsService,
  ) {
    super(checkinsQuery, statePolicy, dates, clients, transactions);
  }

  async execute(token: string): Promise<PublicCheckinView> {
    const { link, client } = await this.openLink(token);
    const { workspace, form } = await this.transactions.run(
      async () => {
        const found = await this.workspaces.findCurrent(link.workspaceId);
        return {
          workspace: found,
          form: await this.forms.currentFor(
            link.workspaceId,
            FormPurpose.CHECKIN,
            found.unitSystem,
          ),
        };
      },
      { workspaceId: link.workspaceId },
    );

    // only what the client needs to fill the form in: no ids, no phone numbers
    return {
      coach: { brandName: workspace.brandName, logoUrl: workspace.logoUrl },
      client: { fullName: client.fullName },
      dueOn: link.dueOn,
      form,
      consents: {
        texts: this.consents.texts().client,
        states: await this.consents.clientStates(
          link.workspaceId,
          link.clientId,
        ),
      },
    };
  }
}
