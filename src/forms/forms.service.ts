import { Injectable } from '@nestjs/common';
import type { IntakeForm } from '../intake/interfaces/intake-form.interface';
import type { UnitSystem } from '../workspaces/enums/unit-system.enum';
import type { FormPurpose } from './enums/form-purpose.enum';
import type {
  FormQuestionInput,
  FormRecord,
} from './interfaces/form.interface';
import { CurrentFormOrchestrator } from './orchestration/current-form.orchestrator';
import { FormDetailsOrchestrator } from './orchestration/form-details.orchestrator';
import { FormResetOrchestrator } from './orchestration/form-reset.orchestrator';
import { FormSavingOrchestrator } from './orchestration/form-saving.orchestrator';
import { FormTemplateOrchestrator } from './orchestration/form-template.orchestrator';

/** The forms module's interface: the questions a coach asks, theirs to rewrite. */
@Injectable()
export class FormsService {
  constructor(
    private readonly details: FormDetailsOrchestrator,
    private readonly saving: FormSavingOrchestrator,
    private readonly resetting: FormResetOrchestrator,
    private readonly templates: FormTemplateOrchestrator,
    private readonly currentForm: CurrentFormOrchestrator,
  ) {}

  current(workspaceId: string, purpose: FormPurpose): Promise<FormRecord> {
    return this.details.execute(workspaceId, purpose);
  }

  save(
    workspaceId: string,
    purpose: FormPurpose,
    questions: FormQuestionInput[],
  ): Promise<FormRecord> {
    return this.saving.execute(workspaceId, purpose, questions);
  }

  reset(workspaceId: string, purpose: FormPurpose): Promise<void> {
    return this.resetting.execute(workspaceId, purpose);
  }

  template(workspaceId: string, templateId: string): Promise<FormRecord> {
    return this.templates.execute(workspaceId, templateId);
  }

  /** For the intake and the check-in: the form to ask a client and to check their answers against. */
  currentFor(
    workspaceId: string,
    purpose: FormPurpose,
    unitSystem: UnitSystem,
  ): Promise<IntakeForm> {
    return this.currentForm.execute(workspaceId, purpose, unitSystem);
  }
}
