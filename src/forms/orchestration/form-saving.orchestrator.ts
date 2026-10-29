import { Injectable } from '@nestjs/common';
import { CheckinFormPolicy } from '../../checkins/policies/checkin-form.policy';
import { TransactionManager } from '../../database/transaction.manager';
import { IntakeFormPolicy } from '../../intake/policies/intake-form.policy';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import type { FormPurpose } from '../enums/form-purpose.enum';
import {
  FormVersionConflictException,
  InvalidFormException,
} from '../exceptions/form-exceptions';
import { FormsQueryHandler } from '../handlers/forms-query.handler';
import type {
  FormQuestionInput,
  FormRecord,
} from '../interfaces/form.interface';
import { DefaultFormLabelsPolicy } from '../policies/default-form-labels.policy';
import { FormDefinitionPolicy } from '../policies/form-definition.policy';
import { BaseFormOrchestrator } from './base-form.orchestrator';

/**
 * Takes over `FormsService.save`. Editing never changes a stored form: the questions are checked, then
 * a new version is inserted and made the current one, so what clients answered on an earlier version
 * stays readable against the questions they were asked. Links already sent and check-ins already made
 * pick up the new version when they are opened.
 */
@Injectable()
export class FormSavingOrchestrator extends BaseFormOrchestrator {
  constructor(
    formsQuery: FormsQueryHandler,
    intakeForm: IntakeFormPolicy,
    checkinForm: CheckinFormPolicy,
    labels: DefaultFormLabelsPolicy,
    transactions: TransactionManager,
    private readonly workspaces: WorkspacesService,
    private readonly definition: FormDefinitionPolicy,
  ) {
    super(formsQuery, intakeForm, checkinForm, labels, transactions);
  }

  async execute(
    workspaceId: string,
    purpose: FormPurpose,
    questions: FormQuestionInput[],
  ): Promise<FormRecord> {
    const checked = this.definition.check(questions);
    if (checked.outcome === 'invalid') {
      throw new InvalidFormException(checked.problems);
    }

    try {
      return await this.transactions.run(
        async () => {
          const version = await this.formsQuery.nextVersion(purpose);
          await this.formsQuery.deactivateCurrent(purpose);
          const templateId = await this.formsQuery.insertTemplate(
            workspaceId,
            purpose,
            version,
          );
          await this.formsQuery.insertQuestions(
            workspaceId,
            templateId,
            checked.questions,
          );

          const { unitSystem } = await this.workspaces.findCurrent(workspaceId);
          return this.record(
            purpose,
            await this.currentForm(purpose, unitSystem),
          );
        },
        { workspaceId },
      );
    } catch (error) {
      // two saves can read the same last version together; the database's rule is the last word
      throw FormVersionConflictException.causes(error)
        ? new FormVersionConflictException()
        : error;
    }
  }
}
