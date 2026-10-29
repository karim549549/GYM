import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { ConsentsController } from './consents.controller';
import { ConsentsService } from './consents.service';
import { ConsentsQueryHandler } from './handlers/consents-query.handler';
import { ClientConsentCheckOrchestrator } from './orchestration/client-consent-check.orchestrator';
import { ClientConsentRecordingOrchestrator } from './orchestration/client-consent-recording.orchestrator';
import { ClientConsentRequirementOrchestrator } from './orchestration/client-consent-requirement.orchestrator';
import { ClientConsentStateOrchestrator } from './orchestration/client-consent-state.orchestrator';
import { ClientConsentSubmissionOrchestrator } from './orchestration/client-consent-submission.orchestrator';
import { ConsentTextListOrchestrator } from './orchestration/consent-text-list.orchestrator';
import { PersonConsentRecordingOrchestrator } from './orchestration/person-consent-recording.orchestrator';
import { PersonConsentStateOrchestrator } from './orchestration/person-consent-state.orchestrator';
import { ClientConsentRequirementPolicy } from './policies/client-consent-requirement.policy';
import { ConsentSourcePolicy } from './policies/consent-source.policy';
import { ConsentStatePolicy } from './policies/consent-state.policy';
import { ConsentTextsPolicy } from './policies/consent-texts.policy';

@Module({
  imports: [ClientsModule],
  controllers: [ConsentsController],
  providers: [
    ConsentsService,
    ConsentsQueryHandler,
    ConsentTextListOrchestrator,
    ClientConsentStateOrchestrator,
    ClientConsentCheckOrchestrator,
    ClientConsentRequirementOrchestrator,
    ClientConsentRecordingOrchestrator,
    ClientConsentSubmissionOrchestrator,
    PersonConsentStateOrchestrator,
    PersonConsentRecordingOrchestrator,
    ClientConsentRequirementPolicy,
    ConsentSourcePolicy,
    ConsentStatePolicy,
    ConsentTextsPolicy,
  ],
  exports: [ConsentsService],
})
export class ConsentsModule {}
