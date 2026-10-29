import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { ConsentsModule } from '../consents/consents.module';
import { FormsModule } from '../forms/forms.module';
import { IntakeFormPolicy } from '../intake/policies/intake-form.policy';
import { MeasurementsModule } from '../measurements/measurements.module';
import { RemindersModule } from '../reminders/reminders.module';
import { SubscriptionDatesPolicy } from '../subscriptions/policies/subscription-dates.policy';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { CheckinsController } from './checkins.controller';
import { CheckinsService } from './checkins.service';
import { CheckinsQueryHandler } from './handlers/checkins-query.handler';
import { CheckinTopUpJob } from './jobs/checkin-top-up.job';
import { CheckinActivityOrchestrator } from './orchestration/checkin-activity.orchestrator';
import { CheckinAtRiskOrchestrator } from './orchestration/checkin-at-risk.orchestrator';
import { CheckinDetailsOrchestrator } from './orchestration/checkin-details.orchestrator';
import { CheckinListOrchestrator } from './orchestration/checkin-list.orchestrator';
import { CheckinReplyOrchestrator } from './orchestration/checkin-reply.orchestrator';
import { CheckinScheduleDetailsOrchestrator } from './orchestration/checkin-schedule-details.orchestrator';
import { CheckinScheduleSettingOrchestrator } from './orchestration/checkin-schedule-setting.orchestrator';
import { CheckinScheduleStoppingOrchestrator } from './orchestration/checkin-schedule-stopping.orchestrator';
import { CheckinSubmissionOrchestrator } from './orchestration/checkin-submission.orchestrator';
import { CheckinTopUpOrchestrator } from './orchestration/checkin-top-up.orchestrator';
import { PublicCheckinConsentStatesOrchestrator } from './orchestration/public-checkin-consent-states.orchestrator';
import { PublicCheckinConsentsOrchestrator } from './orchestration/public-checkin-consents.orchestrator';
import { PublicCheckinFormOrchestrator } from './orchestration/public-checkin-form.orchestrator';
import { CheckinFormPolicy } from './policies/checkin-form.policy';
import { CheckinSchedulePolicy } from './policies/checkin-schedule.policy';
import { CheckinStatePolicy } from './policies/checkin-state.policy';
import { PublicCheckinController } from './public-checkin.controller';

@Module({
  imports: [
    ClientsModule,
    ConsentsModule,
    FormsModule,
    MeasurementsModule,
    RemindersModule,
    WorkspacesModule,
  ],
  controllers: [CheckinsController, PublicCheckinController],
  providers: [
    CheckinsService,
    CheckinsQueryHandler,
    CheckinScheduleSettingOrchestrator,
    CheckinScheduleDetailsOrchestrator,
    CheckinScheduleStoppingOrchestrator,
    CheckinTopUpOrchestrator,
    CheckinListOrchestrator,
    CheckinDetailsOrchestrator,
    CheckinReplyOrchestrator,
    CheckinAtRiskOrchestrator,
    CheckinActivityOrchestrator,
    PublicCheckinFormOrchestrator,
    PublicCheckinConsentsOrchestrator,
    PublicCheckinConsentStatesOrchestrator,
    CheckinSubmissionOrchestrator,
    CheckinSchedulePolicy,
    CheckinStatePolicy,
    CheckinFormPolicy,
    CheckinTopUpJob,
    // both are stateless rules shared with other modules: the dates with subscriptions, and the
    // answer check with the intake, whose forms have the same shape
    SubscriptionDatesPolicy,
    IntakeFormPolicy,
  ],
  exports: [CheckinsService],
})
export class CheckinsModule {}
