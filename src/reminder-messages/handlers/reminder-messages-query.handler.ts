import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { BaseQueryHandler } from '../../common/handlers/base-query.handler';
import { reminderMessages } from '../../database/schema';
import type { ReminderMessageKind } from '../enums/reminder-message-kind.enum';
import type { ReminderMessageRecord } from '../interfaces/reminder-message.interface';

const RECORD = { kind: reminderMessages.kind, body: reminderMessages.body };

/** Data access for the `reminder_messages` table. Row level security keeps it to one workspace. */
@Injectable()
export class ReminderMessagesQueryHandler extends BaseQueryHandler {
  list(): Promise<ReminderMessageRecord[]> {
    return this.db.select(RECORD).from(reminderMessages);
  }

  /** Writes the message of this kind, replacing the one that was there. */
  async save(
    workspaceId: string,
    kind: ReminderMessageKind,
    body: string,
  ): Promise<ReminderMessageRecord> {
    const [saved] = await this.db
      .insert(reminderMessages)
      .values({ workspaceId, kind, body })
      .onConflictDoUpdate({
        target: [reminderMessages.workspaceId, reminderMessages.kind],
        set: { body: sql`excluded.body`, updatedAt: sql`now()` },
      })
      .returning(RECORD);
    return saved;
  }
}
