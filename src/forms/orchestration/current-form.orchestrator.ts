import { Injectable } from '@nestjs/common';
import { CheckinFormPolicy } from '../../checkins/policies/checkin-form.policy';
import { TransactionManager } from '../../database/transaction.manager';
import type { IntakeForm } from '../../intake/interfaces/intake-form.interface';
import { IntakeFormPolicy } from '../../intake/policies/intake-form.policy';
import type { UnitSystem } from '../../workspaces/enums/unit-system.enum';
import type { FormPurpose } from '../enums/form-purpose.enum';
import { FormsQueryHandler } from '../handlers/forms-query.handler';
import { DefaultFormLabelsPolicy } from '../policies/default-form-labels.policy';
import { BaseFormOrchestrator } from './base-form.orchestrator';

/**
 * Takes over `FormsService.currentFor`, for the flows that ask a client the questions (the intake and
 * the check-in): the form to ask and to check the answers against. It joins whatever transaction is
 * open, which is the workspace's.
 */
@Injectable()
export class CurrentFormOrchestrator extends BaseFormOrchestrator {
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
    purpose: FormPurpose,
    unitSystem: UnitSystem,
    namedFormId?: string | null,
  ): Promise<IntakeForm> {
    return this.transactions.run(
      () => this.currentForm(purpose, unitSystem, namedFormId),
      { workspaceId },
    );
  }
}
