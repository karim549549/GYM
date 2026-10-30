import { Injectable } from '@nestjs/common';
import type { IntakeForm } from '../intake/interfaces/intake-form.interface';
import type { UnitSystem } from '../workspaces/enums/unit-system.enum';
import type { FormPurpose } from './enums/form-purpose.enum';
import type {
  FormQuestionInput,
  FormRecord,
  NamedFormRecord,
  NamedFormSummary,
} from './interfaces/form.interface';
import { CurrentFormOrchestrator } from './orchestration/current-form.orchestrator';
import { FormDetailsOrchestrator } from './orchestration/form-details.orchestrator';
import { FormResetOrchestrator } from './orchestration/form-reset.orchestrator';
import { FormSavingOrchestrator } from './orchestration/form-saving.orchestrator';
import { FormTemplateOrchestrator } from './orchestration/form-template.orchestrator';
import { NamedFormArchiveOrchestrator } from './orchestration/named-form-archive.orchestrator';
import { NamedFormCreationOrchestrator } from './orchestration/named-form-creation.orchestrator';
import { NamedFormDetailsOrchestrator } from './orchestration/named-form-details.orchestrator';
import { NamedFormListOrchestrator } from './orchestration/named-form-list.orchestrator';
import { NamedFormUpdateOrchestrator } from './orchestration/named-form-update.orchestrator';

/** The forms module's interface: the questions a coach asks, theirs to rewrite. */
@Injectable()
export class FormsService {
  constructor(
    private readonly details: FormDetailsOrchestrator,
    private readonly saving: FormSavingOrchestrator,
    private readonly resetting: FormResetOrchestrator,
    private readonly templates: FormTemplateOrchestrator,
    private readonly currentForm: CurrentFormOrchestrator,
    private readonly namedList: NamedFormListOrchestrator,
    private readonly namedCreation: NamedFormCreationOrchestrator,
    private readonly namedDetails: NamedFormDetailsOrchestrator,
    private readonly namedUpdate: NamedFormUpdateOrchestrator,
    private readonly namedArchive: NamedFormArchiveOrchestrator,
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

  /**
   * For the intake and the check-in: the form to ask a client and to check their answers against.
   * A link that pins one of the coach's named forms passes it; without one, the default form is used.
   */
  currentFor(
    workspaceId: string,
    purpose: FormPurpose,
    unitSystem: UnitSystem,
    namedFormId?: string | null,
  ): Promise<IntakeForm> {
    return this.currentForm.execute(
      workspaceId,
      purpose,
      unitSystem,
      namedFormId,
    );
  }

  namedForms(
    workspaceId: string,
    purpose?: FormPurpose,
  ): Promise<NamedFormSummary[]> {
    return this.namedList.execute(workspaceId, purpose);
  }

  namedForm(
    workspaceId: string,
    namedFormId: string,
  ): Promise<NamedFormRecord> {
    return this.namedDetails.execute(workspaceId, namedFormId);
  }

  createNamedForm(
    workspaceId: string,
    purpose: FormPurpose,
    name: string,
    questions: FormQuestionInput[],
  ): Promise<NamedFormRecord> {
    return this.namedCreation.execute(workspaceId, purpose, name, questions);
  }

  updateNamedForm(
    workspaceId: string,
    namedFormId: string,
    changes: { name?: string; questions?: FormQuestionInput[] },
  ): Promise<NamedFormRecord> {
    return this.namedUpdate.execute(workspaceId, namedFormId, changes);
  }

  archiveNamedForm(workspaceId: string, namedFormId: string): Promise<void> {
    return this.namedArchive.execute(workspaceId, namedFormId);
  }
}
