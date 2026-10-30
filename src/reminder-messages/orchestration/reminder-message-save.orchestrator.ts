import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import type { ReminderMessageKind } from '../enums/reminder-message-kind.enum';
import { ReminderMessagesQueryHandler } from '../handlers/reminder-messages-query.handler';
import type { ReminderMessageRecord } from '../interfaces/reminder-message.interface';

/** Takes over `ReminderMessagesService.save`: writing a kind again replaces what was there. */
@Injectable()
export class ReminderMessageSaveOrchestrator {
  constructor(
    private readonly messagesQuery: ReminderMessagesQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    kind: ReminderMessageKind,
    body: string,
  ): Promise<ReminderMessageRecord> {
    return this.transactions.run(
      () => this.messagesQuery.save(workspaceId, kind, body),
      { workspaceId },
    );
  }
}
