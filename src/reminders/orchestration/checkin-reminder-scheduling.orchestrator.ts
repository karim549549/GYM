import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { ReminderAudience } from '../enums/reminder-audience.enum';
import { ReminderKind } from '../enums/reminder-kind.enum';
import { ReminderSubjectType } from '../enums/reminder-subject-type.enum';
import { RemindersQueryHandler } from '../handlers/reminders-query.handler';
import type { CheckinReminderSubject } from '../interfaces/reminder.interface';
import { ReminderSchedulePolicy } from '../policies/reminder-schedule.policy';

/**
 * Takes over `RemindersService.scheduleCheckins`: the client is sent the link to each check-in at
 * the hour the coach chose on its day. It joins the transaction that created the check-ins.
 */
@Injectable()
export class CheckinReminderSchedulingOrchestrator {
  constructor(
    private readonly remindersQuery: RemindersQueryHandler,
    private readonly schedulePolicy: ReminderSchedulePolicy,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    subjects: CheckinReminderSubject[],
  ): Promise<void> {
    return this.transactions.run(
      () =>
        this.remindersQuery.createMany(
          subjects.map((subject) => ({
            workspaceId,
            subjectType: ReminderSubjectType.CHECKIN,
            clientId: subject.clientId,
            subjectId: subject.checkinId,
            kind: ReminderKind.CHECKIN_DUE,
            audience: ReminderAudience.CLIENT,
            scheduledFor: this.schedulePolicy.forCheckin(
              subject.dueOn,
              subject.sendHour,
              new Date(),
            ),
            payload: { link: subject.link },
          })),
        ),
      { workspaceId },
    );
  }
}
