import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { ConsentsService } from '../../consents/consents.service';
import { TransactionManager } from '../../database/transaction.manager';
import { FormPurpose } from '../../forms/enums/form-purpose.enum';
import { FormsService } from '../../forms/forms.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { IntakeQueryHandler } from '../handlers/intake-query.handler';
import type { PublicIntakeView } from '../interfaces/intake.interface';
import { IntakeLinkPolicy } from '../policies/intake-link.policy';
import { BasePublicIntakeOrchestrator } from './base-public-intake.orchestrator';

/** Takes over `IntakeService.openForm`: what a client sees when they open their link. */
@Injectable()
export class PublicIntakeFormOrchestrator extends BasePublicIntakeOrchestrator {
  constructor(
    intakeQuery: IntakeQueryHandler,
    linkPolicy: IntakeLinkPolicy,
    clients: ClientsService,
    transactions: TransactionManager,
    private readonly workspaces: WorkspacesService,
    private readonly forms: FormsService,
    private readonly consents: ConsentsService,
  ) {
    super(intakeQuery, linkPolicy, clients, transactions);
  }

  async execute(token: string): Promise<PublicIntakeView> {
    const { link, client } = await this.openLink(token);
    const { workspace, form } = await this.transactions.run(
      async () => {
        const found = await this.workspaces.findCurrent(link.workspaceId);
        return {
          workspace: found,
          form: await this.forms.currentFor(
            link.workspaceId,
            FormPurpose.INTAKE,
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
      expiresAt: link.expiresAt,
      form,
      consents: this.consents.texts().client,
    };
  }
}
