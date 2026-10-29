import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import type { FormPurpose } from '../enums/form-purpose.enum';
import { FormsQueryHandler } from '../handlers/forms-query.handler';

/**
 * Takes over `FormsService.reset`: back to the built-in form. The coach's versions are kept, since
 * answers refer to them; only none of them is current any more. Doing it when already on the built-in
 * form changes nothing.
 */
@Injectable()
export class FormResetOrchestrator {
  constructor(
    private readonly formsQuery: FormsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string, purpose: FormPurpose): Promise<void> {
    return this.transactions.run(
      () => this.formsQuery.deactivateCurrent(purpose),
      { workspaceId },
    );
  }
}
