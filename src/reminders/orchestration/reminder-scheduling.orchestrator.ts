import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { ReminderSubjectType } from '../enums/reminder-subject-type.enum';
import { RemindersQueryHandler } from '../handlers/reminders-query.handler';
import type { SubscriptionReminderSubject } from '../interfaces/reminder.interface';
import { ReminderSchedulePolicy } from '../policies/reminder-schedule.policy';

/**
 * Takes over `RemindersService.schedule`. Whenever a subscription's end date is set or moved, what
 * has not gone out yet is dropped and planned again from the new date. What already went out is
 * kept and not sent twice, even if the new date would have called for it.
 */
@Injectable()
export class ReminderSchedulingOrchestrator {
  constructor(
    private readonly remindersQuery: RemindersQueryHandler,
    private readonly schedulePolicy: ReminderSchedulePolicy,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    subject: SubscriptionReminderSubject,
  ): Promise<void> {
    return this.transactions.run(
      async () => {
        await this.remindersQuery.deleteUnsent(
          ReminderSubjectType.SUBSCRIPTION,
          [subject.subscriptionId],
        );
        const planned = this.schedulePolicy.forSubscription(
          subject.endsOn,
          new Date(),
        );
        await this.remindersQuery.createMany(
          planned.map((reminder) => ({
            ...reminder,
            workspaceId,
            subjectType: ReminderSubjectType.SUBSCRIPTION,
            clientId: subject.clientId,
            subjectId: subject.subscriptionId,
            payload: { endsOn: subject.endsOn },
          })),
        );
      },
      { workspaceId },
    );
  }
}
