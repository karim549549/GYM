import { Module } from '@nestjs/common';
import { CheckinFormPolicy } from '../checkins/policies/checkin-form.policy';
import { IntakeFormPolicy } from '../intake/policies/intake-form.policy';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';
import { FormsQueryHandler } from './handlers/forms-query.handler';
import { CurrentFormOrchestrator } from './orchestration/current-form.orchestrator';
import { FormDetailsOrchestrator } from './orchestration/form-details.orchestrator';
import { FormResetOrchestrator } from './orchestration/form-reset.orchestrator';
import { FormSavingOrchestrator } from './orchestration/form-saving.orchestrator';
import { FormTemplateOrchestrator } from './orchestration/form-template.orchestrator';
import { DefaultFormLabelsPolicy } from './policies/default-form-labels.policy';
import { FormDefinitionPolicy } from './policies/form-definition.policy';

@Module({
  imports: [WorkspacesModule],
  controllers: [FormsController],
  providers: [
    FormsService,
    FormsQueryHandler,
    FormDetailsOrchestrator,
    FormSavingOrchestrator,
    FormResetOrchestrator,
    FormTemplateOrchestrator,
    CurrentFormOrchestrator,
    FormDefinitionPolicy,
    DefaultFormLabelsPolicy,
    // the built-in forms are code in the intake and check-ins modules; they are stateless rules, so the
    // forms module holds its own copies rather than importing those modules (which import this one)
    IntakeFormPolicy,
    CheckinFormPolicy,
  ],
  exports: [FormsService],
})
export class FormsModule {}
