import { Injectable } from '@nestjs/common';
import { CheckinFormPolicy } from '../../checkins/policies/checkin-form.policy';
import { TransactionManager } from '../../database/transaction.manager';
import { IntakeFormPolicy } from '../../intake/policies/intake-form.policy';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { FormTemplateNotFoundException } from '../exceptions/form-exceptions';
import { FormsQueryHandler } from '../handlers/forms-query.handler';
import type { NamedFormRecord } from '../interfaces/form.interface';
import { DefaultFormLabelsPolicy } from '../policies/default-form-labels.policy';
import { BaseFormOrchestrator } from './base-form.orchestrator';

/** Takes over `FormsService.namedForm`: one named form with the questions of the version in use. */
@Injectable()
export class NamedFormDetailsOrchestrator extends BaseFormOrchestrator {
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

  execute(workspaceId: string, namedFormId: string): Promise<NamedFormRecord> {
    return this.transactions.run(() => this.read(workspaceId, namedFormId), {
      workspaceId,
    });
  }

  /** Also used by the flows that just saved it, inside their own transaction. */
  async read(
    workspaceId: string,
    namedFormId: string,
  ): Promise<NamedFormRecord> {
    const named = await this.formsQuery.findNamed(namedFormId);
    if (!named) {
      throw new FormTemplateNotFoundException();
    }
    const { unitSystem } = await this.workspaces.findCurrent(workspaceId);
    const form = await this.currentForm(named.purpose, unitSystem, named.id);
    return {
      ...this.record(named.purpose, form),
      id: named.id,
      name: named.name,
    };
  }
}
