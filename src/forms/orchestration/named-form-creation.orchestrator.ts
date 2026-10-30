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
  NamedFormRecord,
} from '../interfaces/form.interface';
import { DefaultFormLabelsPolicy } from '../policies/default-form-labels.policy';
import { FormDefinitionPolicy } from '../policies/form-definition.policy';
import { BaseFormOrchestrator } from './base-form.orchestrator';
import { NamedFormDetailsOrchestrator } from './named-form-details.orchestrator';

/**
 * Takes over `FormsService.createNamedForm`: a new form under a name, with its first version. The
 * questions are checked like any form's, so a bad one is refused before anything is stored.
 */
@Injectable()
export class NamedFormCreationOrchestrator extends BaseFormOrchestrator {
  constructor(
    formsQuery: FormsQueryHandler,
    intakeForm: IntakeFormPolicy,
    checkinForm: CheckinFormPolicy,
    labels: DefaultFormLabelsPolicy,
    transactions: TransactionManager,
    private readonly definition: FormDefinitionPolicy,
    private readonly details: NamedFormDetailsOrchestrator,
  ) {
    super(formsQuery, intakeForm, checkinForm, labels, transactions);
  }

  async execute(
    workspaceId: string,
    purpose: FormPurpose,
    name: string,
    questions: FormQuestionInput[],
  ): Promise<NamedFormRecord> {
    const checked = this.definition.check(questions);
    if (checked.outcome === 'invalid') {
      throw new InvalidFormException(checked.problems);
    }
    try {
      return await this.transactions.run(
        async () => {
          const named = await this.formsQuery.insertNamed(
            workspaceId,
            purpose,
            name,
          );
          const templateId = await this.formsQuery.insertTemplate(
            workspaceId,
            purpose,
            1,
            named.id,
          );
          await this.formsQuery.insertQuestions(
            workspaceId,
            templateId,
            checked.questions,
          );
          return this.details.read(workspaceId, named.id);
        },
        { workspaceId },
      );
    } catch (error) {
      throw FormVersionConflictException.causes(error)
        ? new FormVersionConflictException()
        : error;
    }
  }
}
