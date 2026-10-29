import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { ReminderSubjectType } from '../enums/reminder-subject-type.enum';
import { RemindersQueryHandler } from '../handlers/reminders-query.handler';

/** Takes over `RemindersService.cancel`: a subscription that is paused or over has nothing left to announce. */
@Injectable()
export class ReminderCancellationOrchestrator {
  constructor(
    private readonly remindersQuery: RemindersQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string, subscriptionId: string): Promise<void> {
    return this.transactions.run(
      () =>
        this.remindersQuery.deleteUnsent(ReminderSubjectType.SUBSCRIPTION, [
          subscriptionId,
        ]),
      { workspaceId },
    );
  }
}
