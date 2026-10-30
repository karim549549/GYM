import { Injectable } from '@nestjs/common';
import { CheckinFormPolicy } from '../../checkins/policies/checkin-form.policy';
import { TransactionManager } from '../../database/transaction.manager';
import { IntakeFormPolicy } from '../../intake/policies/intake-form.policy';
import type { FormPurpose } from '../enums/form-purpose.enum';
import { FormsQueryHandler } from '../handlers/forms-query.handler';
import type { NamedFormSummary } from '../interfaces/form.interface';
import { DefaultFormLabelsPolicy } from '../policies/default-form-labels.policy';
import { BaseFormOrchestrator } from './base-form.orchestrator';

/** Takes over `FormsService.namedForms`: the coach's forms, each with the version in use. */
@Injectable()
export class NamedFormListOrchestrator extends BaseFormOrchestrator {
  constructor(
    formsQuery: FormsQueryHandler,
    intakeForm: IntakeFormPolicy,
    checkinForm: CheckinFormPolicy,
    labels: DefaultFormLabelsPolicy,
    transactions: TransactionManager,
  ) {
    super(formsQuery, intakeForm, checkinForm, labels, transactions);
  }

  execute(
    workspaceId: string,
    purpose?: FormPurpose,
  ): Promise<NamedFormSummary[]> {
    return this.transactions.run(() => this.formsQuery.listNamed(purpose), {
      workspaceId,
    });
  }
}
