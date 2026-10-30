import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { IntakeStatus } from '../../clients/enums/intake-status.enum';
import type { ClientConsentsDto } from '../../consents/dto/consent.dto';
import { ClientConsentType } from '../../consents/enums/client-consent-type.enum';
import { ConsentSource } from '../../consents/enums/consent-source.enum';
import { ConsentsService } from '../../consents/consents.service';
import { TransactionManager } from '../../database/transaction.manager';
import { FormPurpose } from '../../forms/enums/form-purpose.enum';
import { FormsService } from '../../forms/forms.service';
import { MeasurementSource } from '../../measurements/enums/measurement-source.enum';
import { MeasurementsService } from '../../measurements/measurements.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { IntakeSubmitter } from '../enums/intake-submitter.enum';
import {
  IntakeAlreadySubmittedException,
  InvalidIntakeAnswersException,
} from '../exceptions/intake-exceptions';
import { IntakeQueryHandler } from '../handlers/intake-query.handler';
import { IntakeFormPolicy } from '../policies/intake-form.policy';
import { IntakeLinkPolicy } from '../policies/intake-link.policy';
import { BasePublicIntakeOrchestrator } from './base-public-intake.orchestrator';

/**
 * Takes over `IntakeService.submit`. Everything a submission does happens in one transaction in
 * the client's workspace: the link is taken, the answers kept as submitted, the client marked as
 * done, and the numbers written as the client's first measurements. If any step fails, none
 * stand, and the link stays open for another try.
 */
@Injectable()
export class IntakeSubmissionOrchestrator extends BasePublicIntakeOrchestrator {
  constructor(
    intakeQuery: IntakeQueryHandler,
    linkPolicy: IntakeLinkPolicy,
    clients: ClientsService,
    transactions: TransactionManager,
    private readonly workspaces: WorkspacesService,
    private readonly measurements: MeasurementsService,
    private readonly formPolicy: IntakeFormPolicy,
    private readonly forms: FormsService,
    private readonly consents: ConsentsService,
  ) {
    super(intakeQuery, linkPolicy, clients, transactions);
  }

  async execute(
    token: string,
    answers: unknown,
    consents: ClientConsentsDto,
  ): Promise<{ submittedAt: Date }> {
    const { link } = await this.openLink(token);

    return this.transactions.run(
      async () => {
        const workspace = await this.workspaces.findCurrent(link.workspaceId);
        const form = await this.forms.currentFor(
          link.workspaceId,
          FormPurpose.INTAKE,
          workspace.unitSystem,
          link.namedFormId,
        );
        const checked = this.formPolicy.check(form, answers);
        if (checked.outcome === 'invalid') {
          throw new InvalidIntakeAnswersException(checked.problems);
        }

        // without the required consents nothing below happens: the whole submission is refused
        await this.consents.submitForClient(
          link.workspaceId,
          link.clientId,
          [
            {
              type: ClientConsentType.DATA_PROCESSING,
              granted: consents.dataProcessing,
            },
            {
              type: ClientConsentType.HEALTH_DATA,
              granted: consents.healthData,
            },
            {
              type: ClientConsentType.WHATSAPP_NOTIFICATIONS,
              granted: consents.whatsappNotifications ?? false,
            },
          ],
          ConsentSource.INTAKE_LINK,
        );

        // taking the link comes first among the writes: of two requests at once, one loses here
        if (!(await this.intakeQuery.claimLink(link.id))) {
          throw new IntakeAlreadySubmittedException();
        }
        const response = await this.intakeQuery.insertResponse({
          workspaceId: link.workspaceId,
          clientId: link.clientId,
          linkId: link.id,
          answers: checked.answers,
          formVersion: form.version,
          templateId: form.templateId ?? null,
          submittedBy: IntakeSubmitter.CLIENT,
        });
        await this.clients.setIntakeStatus(
          link.workspaceId,
          link.clientId,
          IntakeStatus.SUBMITTED,
        );
        await this.measurements.record(
          link.workspaceId,
          link.clientId,
          checked.readings,
          MeasurementSource.INTAKE,
        );
        return response;
      },
      { workspaceId: link.workspaceId },
    );
  }
}
