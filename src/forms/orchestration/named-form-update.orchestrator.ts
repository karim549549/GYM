import { Injectable } from '@nestjs/common';
import { CheckinFormPolicy } from '../../checkins/policies/checkin-form.policy';
import { TransactionManager } from '../../database/transaction.manager';
import { IntakeFormPolicy } from '../../intake/policies/intake-form.policy';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import {
  FormTemplateNotFoundException,
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
 * Takes over `FormsService.updateNamedForm`: a new name, new questions, or both. Editing never changes a
 * stored version: new questions become the next version, so what clients answered earlier stays
 * readable against the questions they were asked. Links already sent pick up the new version.
 */
@Injectable()
export class NamedFormUpdateOrchestrator extends BaseFormOrchestrator {
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
    namedFormId: string,
    changes: { name?: string; questions?: FormQuestionInput[] },
  ): Promise<NamedFormRecord> {
    const checked = changes.questions
      ? this.definition.check(changes.questions)
      : null;
    if (checked?.outcome === 'invalid') {
      throw new InvalidFormException(checked.problems);
    }
    try {
      return await this.transactions.run(
        async () => {
          const named = await this.formsQuery.findNamed(namedFormId);
          if (!named) {
            throw new FormTemplateNotFoundException();
          }
          if (changes.name !== undefined) {
            await this.formsQuery.renameNamed(named.id, changes.name);
          }
          if (checked?.outcome === 'valid') {
            const version = await this.formsQuery.nextVersionOf(named.id);
            await this.formsQuery.deactivateCurrentOf(named.id);
            const templateId = await this.formsQuery.insertTemplate(
              workspaceId,
              named.purpose,
              version,
              named.id,
            );
            await this.formsQuery.insertQuestions(
              workspaceId,
              templateId,
              checked.questions,
            );
          }
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
