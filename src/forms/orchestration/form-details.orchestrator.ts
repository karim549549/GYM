import { Injectable } from '@nestjs/common';
import { CheckinFormPolicy } from '../../checkins/policies/checkin-form.policy';
import { TransactionManager } from '../../database/transaction.manager';
import { IntakeFormPolicy } from '../../intake/policies/intake-form.policy';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import type { FormPurpose } from '../enums/form-purpose.enum';
import { FormsQueryHandler } from '../handlers/forms-query.handler';
import type { FormRecord } from '../interfaces/form.interface';
import { DefaultFormLabelsPolicy } from '../policies/default-form-labels.policy';
import { BaseFormOrchestrator } from './base-form.orchestrator';

/**
 * Takes over `FormsService.current`: the form the coach is on, to start editing from. Until they write
 * their own it is the built-in form with its Arabic wording, so the builder never opens on a blank page.
 */
@Injectable()
export class FormDetailsOrchestrator extends BaseFormOrchestrator {
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

  execute(workspaceId: string, purpose: FormPurpose): Promise<FormRecord> {
    return this.transactions.run(
      async () => {
        const { unitSystem } = await this.workspaces.findCurrent(workspaceId);
        return this.record(
          purpose,
          await this.currentForm(purpose, unitSystem),
        );
      },
      { workspaceId },
    );
  }
}
