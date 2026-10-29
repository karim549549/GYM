import { Injectable } from '@nestjs/common';
import { CheckinFormPolicy } from '../../checkins/policies/checkin-form.policy';
import { TransactionManager } from '../../database/transaction.manager';
import { IntakeFormPolicy } from '../../intake/policies/intake-form.policy';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { FormTemplateNotFoundException } from '../exceptions/form-exceptions';
import { FormsQueryHandler } from '../handlers/forms-query.handler';
import type { FormRecord } from '../interfaces/form.interface';
import { DefaultFormLabelsPolicy } from '../policies/default-form-labels.policy';
import { BaseFormOrchestrator } from './base-form.orchestrator';

/**
 * Takes over `FormsService.template`: one version of the coach's form by its id, current or not, so
 * what a client answered can always be read against the questions they were actually asked.
 */
@Injectable()
export class FormTemplateOrchestrator extends BaseFormOrchestrator {
  constructor(
    formsQuery: FormsQueryHandler,
    intakeForm: IntakeFormPolicy,
    checkinForm: CheckinFormPolicy,
    labels: DefaultFormLabelsPolicy,
    transactions: TransactionManager,
    private readonly workspaces: WorkspacesService,
  ) {
    super(formsQuery, intakeForm, checkinForm, labels, transactions);
  }

  execute(workspaceId: string, templateId: string): Promise<FormRecord> {
    return this.transactions.run(
      async () => {
        const template = await this.formsQuery.findById(templateId);
        if (!template) {
          throw new FormTemplateNotFoundException();
        }
        const { unitSystem } = await this.workspaces.findCurrent(workspaceId);
        return this.record(
          template.purpose,
          await this.customForm(template, unitSystem),
        );
      },
      { workspaceId },
    );
  }
}
