import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { ReminderSubjectType } from '../enums/reminder-subject-type.enum';
import { RemindersQueryHandler } from '../handlers/reminders-query.handler';

/** Takes over `RemindersService.cancelCheckins`: check-ins that are no longer asked for need no link sent. */
@Injectable()
export class CheckinReminderCancellationOrchestrator {
  constructor(
    private readonly remindersQuery: RemindersQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string, checkinIds: string[]): Promise<void> {
    return this.transactions.run(
      () =>
        this.remindersQuery.deleteUnsent(
          ReminderSubjectType.CHECKIN,
          checkinIds,
        ),
      { workspaceId },
    );
  }
}
