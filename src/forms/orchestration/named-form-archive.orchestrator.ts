import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { FormTemplateNotFoundException } from '../exceptions/form-exceptions';
import { FormsQueryHandler } from '../handlers/forms-query.handler';

/**
 * Takes over `FormsService.archiveNamedForm`. The form leaves the coach's list but is never deleted:
 * answers and links already sent refer to it.
 */
@Injectable()
export class NamedFormArchiveOrchestrator {
  constructor(
    private readonly formsQuery: FormsQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(workspaceId: string, namedFormId: string): Promise<void> {
    const archived = await this.transactions.run(
      () => this.formsQuery.archiveNamed(namedFormId),
      { workspaceId },
    );
    if (!archived) {
      throw new FormTemplateNotFoundException();
    }
  }
}
