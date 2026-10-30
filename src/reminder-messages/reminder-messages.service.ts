import { Injectable } from '@nestjs/common';
import type { ReminderMessageKind } from './enums/reminder-message-kind.enum';
import type { ReminderMessageRecord } from './interfaces/reminder-message.interface';
import { ReminderMessageListOrchestrator } from './orchestration/reminder-message-list.orchestrator';
import { ReminderMessageSaveOrchestrator } from './orchestration/reminder-message-save.orchestrator';

/** The reminder-messages module's interface: the wording a coach chose for each reminder. */
@Injectable()
export class ReminderMessagesService {
  constructor(
    private readonly messageList: ReminderMessageListOrchestrator,
    private readonly messageSave: ReminderMessageSaveOrchestrator,
  ) {}

  list(workspaceId: string): Promise<ReminderMessageRecord[]> {
    return this.messageList.execute(workspaceId);
  }

  save(
    workspaceId: string,
    kind: ReminderMessageKind,
    body: string,
  ): Promise<ReminderMessageRecord> {
    return this.messageSave.execute(workspaceId, kind, body);
  }
}
