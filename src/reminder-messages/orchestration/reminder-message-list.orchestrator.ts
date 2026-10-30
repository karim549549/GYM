import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { ReminderMessagesQueryHandler } from '../handlers/reminder-messages-query.handler';
import type { ReminderMessageRecord } from '../interfaces/reminder-message.interface';

/** Takes over `ReminderMessagesService.list`: the messages the coach has written so far. */
@Injectable()
export class ReminderMessageListOrchestrator {
  constructor(
    private readonly messagesQuery: ReminderMessagesQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string): Promise<ReminderMessageRecord[]> {
    return this.transactions.run(() => this.messagesQuery.list(), {
      workspaceId,
    });
  }
}
