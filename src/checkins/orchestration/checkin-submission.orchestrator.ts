import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { ConsentsService } from '../../consents/consents.service';
import { ClientConsentType } from '../../consents/enums/client-consent-type.enum';
import { TransactionManager } from '../../database/transaction.manager';
import { FormPurpose } from '../../forms/enums/form-purpose.enum';
import { FormsService } from '../../forms/forms.service';
import { IntakeFormPolicy } from '../../intake/policies/intake-form.policy';
import { MeasurementSource } from '../../measurements/enums/measurement-source.enum';
import { MeasurementsService } from '../../measurements/measurements.service';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import {
  CheckinAlreadySubmittedException,
  InvalidCheckinAnswersException,
} from '../exceptions/checkin-exceptions';
import { CheckinsQueryHandler } from '../handlers/checkins-query.handler';
import { CheckinStatePolicy } from '../policies/checkin-state.policy';
import { BasePublicCheckinOrchestrator } from './base-public-checkin.orchestrator';

/**
 * Takes over `CheckinsService.submit`. The answers are checked first; then, in one transaction in
 * the client's workspace, the check-in is taken (of two requests at once one gets it) and the
 * numbers become measurements, the same day's reading replaced rather than doubled. A failure
 * anywhere leaves the check-in open for another try. One rule judges these answers and the
 * intake's, since both forms have the same shape.
 */
@Injectable()
export class CheckinSubmissionOrchestrator extends BasePublicCheckinOrchestrator {
  constructor(
    checkinsQuery: CheckinsQueryHandler,
    statePolicy: CheckinStatePolicy,
    dates: SubscriptionDatesPolicy,
    clients: ClientsService,
    transactions: TransactionManager,
    private readonly workspaces: WorkspacesService,
    private readonly measurements: MeasurementsService,
    private readonly forms: FormsService,
    private readonly answerPolicy: IntakeFormPolicy,
    private readonly consents: ConsentsService,
  ) {
    super(checkinsQuery, statePolicy, dates, clients, transactions);
  }

  async execute(
    token: string,
    answers: unknown,
  ): Promise<{ submittedAt: Date }> {
    const { link } = await this.openLink(token);

    return this.transactions.run(
      async () => {
        // health answers are taken only from a client who agrees to the coach having them
        await this.consents.require(link.workspaceId, link.clientId, [
          ClientConsentType.DATA_PROCESSING,
          ClientConsentType.HEALTH_DATA,
        ]);
        const workspace = await this.workspaces.findCurrent(link.workspaceId);
        const form = await this.forms.currentFor(
          link.workspaceId,
          FormPurpose.CHECKIN,
          workspace.unitSystem,
        );
        const checked = this.answerPolicy.check(form, answers);
        if (checked.outcome === 'invalid') {
          throw new InvalidCheckinAnswersException(checked.problems);
        }

        const submittedAt = await this.checkinsQuery.submit(
          link.id,
          checked.answers,
          { version: form.version, templateId: form.templateId ?? null },
        );
        if (!submittedAt) {
          throw new CheckinAlreadySubmittedException();
        }
        await this.measurements.record(
          link.workspaceId,
          link.clientId,
          checked.readings,
          MeasurementSource.CHECKIN,
        );
        return { submittedAt };
      },
      { workspaceId: link.workspaceId },
    );
  }
}
