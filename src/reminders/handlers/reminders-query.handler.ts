import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { BaseQueryHandler } from '../../common/handlers/base-query.handler';
import { reminders } from '../../database/schema';
import { ReminderSubjectType } from '../enums/reminder-subject-type.enum';
import type {
  ClaimedReminder,
  NewReminder,
} from '../interfaces/reminder.interface';

/** Data access for the `reminders` table. */
@Injectable()
export class RemindersQueryHandler extends BaseQueryHandler {
  /** Drops what has not gone out yet; a reminder that was sent is a record and stays. */
  async deleteUnsent(
    subjectType: ReminderSubjectType,
    subjectIds: string[],
  ): Promise<void> {
    if (subjectIds.length === 0) {
      return;
    }
    await this.db
      .delete(reminders)
      .where(
        and(
          eq(reminders.subjectType, subjectType),
          inArray(reminders.subjectId, subjectIds),
          isNull(reminders.sentAt),
        ),
      );
  }

  /** A reminder that already exists for the same subject, kind and audience is left alone, sent or not. */
  async createMany(planned: NewReminder[]): Promise<void> {
    if (planned.length === 0) {
      return;
    }
    await this.db.insert(reminders).values(planned).onConflictDoNothing();
  }

  /**
   * Takes the due reminders, oldest first, and marks them sent in the same statement. `skip locked`
   * lets several senders work at once without any of them waiting for another or taking the same
   * row, and marking before sending means a crash loses a reminder rather than sending it twice.
   */
  async claimDue(limit: number): Promise<ClaimedReminder[]> {
    const result = await this.db.execute<{
      id: string;
      workspace_id: string;
      client_id: string;
      kind: ClaimedReminder['kind'];
      audience: ClaimedReminder['audience'];
      payload: Record<string, string>;
    }>(sql`
      update reminders
      set sent_at = now()
      where id in (
        select id from reminders
        where sent_at is null and scheduled_for <= now()
        order by scheduled_for
        limit ${limit}
        for update skip locked
      )
      returning id, workspace_id, client_id, kind, audience, payload
    `);
    return result.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      clientId: row.client_id,
      kind: row.kind,
      audience: row.audience,
      payload: row.payload,
    }));
  }

  async markFailed(id: string, reason: string): Promise<void> {
    await this.db
      .update(reminders)
      .set({ failedReason: reason })
      .where(eq(reminders.id, id));
  }
}
