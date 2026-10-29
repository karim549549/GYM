import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { ConsentsModule } from '../consents/consents.module';
import { SubscriptionDatesPolicy } from '../subscriptions/policies/subscription-dates.policy';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { RemindersQueryHandler } from './handlers/reminders-query.handler';
import { ReminderDispatchJob } from './jobs/reminder-dispatch.job';
import { CheckinReminderCancellationOrchestrator } from './orchestration/checkin-reminder-cancellation.orchestrator';
import { CheckinReminderSchedulingOrchestrator } from './orchestration/checkin-reminder-scheduling.orchestrator';
import { ReminderCancellationOrchestrator } from './orchestration/reminder-cancellation.orchestrator';
import { ReminderDispatchOrchestrator } from './orchestration/reminder-dispatch.orchestrator';
import { ReminderSchedulingOrchestrator } from './orchestration/reminder-scheduling.orchestrator';
import { ReminderSchedulePolicy } from './policies/reminder-schedule.policy';
import { RemindersService } from './reminders.service';

@Module({
  imports: [ClientsModule, ConsentsModule, WorkspacesModule, WhatsAppModule],
  providers: [
    RemindersService,
    RemindersQueryHandler,
    ReminderSchedulingOrchestrator,
    ReminderCancellationOrchestrator,
    ReminderDispatchOrchestrator,
    CheckinReminderSchedulingOrchestrator,
    CheckinReminderCancellationOrchestrator,
    ReminderDispatchJob,
    ReminderSchedulePolicy,
    // the dates rule is shared with subscriptions; it holds no state
    SubscriptionDatesPolicy,
  ],
  exports: [RemindersService],
})
export class RemindersModule {}
