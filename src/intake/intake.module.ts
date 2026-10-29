import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { ConsentsModule } from '../consents/consents.module';
import { FormsModule } from '../forms/forms.module';
import { MeasurementsModule } from '../measurements/measurements.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { IntakeQueryHandler } from './handlers/intake-query.handler';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';
import { IntakeAnswersOrchestrator } from './orchestration/intake-answers.orchestrator';
import { IntakeLinkCreationOrchestrator } from './orchestration/intake-link-creation.orchestrator';
import { IntakeSubmissionOrchestrator } from './orchestration/intake-submission.orchestrator';
import { PublicIntakeFormOrchestrator } from './orchestration/public-intake-form.orchestrator';
import { IntakeFormPolicy } from './policies/intake-form.policy';
import { IntakeLinkPolicy } from './policies/intake-link.policy';
import { PublicIntakeController } from './public-intake.controller';

@Module({
  imports: [
    ClientsModule,
    ConsentsModule,
    FormsModule,
    WorkspacesModule,
    MeasurementsModule,
  ],
  controllers: [IntakeController, PublicIntakeController],
  providers: [
    IntakeService,
    IntakeQueryHandler,
    IntakeLinkCreationOrchestrator,
    PublicIntakeFormOrchestrator,
    IntakeSubmissionOrchestrator,
    IntakeAnswersOrchestrator,
    IntakeFormPolicy,
    IntakeLinkPolicy,
  ],
})
export class IntakeModule {}
