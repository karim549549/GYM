import { Module } from '@nestjs/common';
import { ReminderMessagesQueryHandler } from './handlers/reminder-messages-query.handler';
import { ReminderMessageListOrchestrator } from './orchestration/reminder-message-list.orchestrator';
import { ReminderMessageSaveOrchestrator } from './orchestration/reminder-message-save.orchestrator';
import { ReminderMessagesController } from './reminder-messages.controller';
import { ReminderMessagesService } from './reminder-messages.service';

@Module({
  controllers: [ReminderMessagesController],
  providers: [
    ReminderMessagesService,
    ReminderMessagesQueryHandler,
    ReminderMessageListOrchestrator,
    ReminderMessageSaveOrchestrator,
  ],
  exports: [ReminderMessagesService],
})
export class ReminderMessagesModule {}
