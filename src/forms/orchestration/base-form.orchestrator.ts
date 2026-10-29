import { CheckinFormPolicy } from '../../checkins/policies/checkin-form.policy';
import { TransactionManager } from '../../database/transaction.manager';
import type {
  IntakeForm,
  IntakeQuestion,
} from '../../intake/interfaces/intake-form.interface';
import { IntakeFormPolicy } from '../../intake/policies/intake-form.policy';
import type { UnitSystem } from '../../workspaces/enums/unit-system.enum';
import { FormPurpose } from '../enums/form-purpose.enum';
import { FormsQueryHandler } from '../handlers/forms-query.handler';
import type {
  FormQuestionRecord,
  FormRecord,
  StoredFormTemplate,
} from '../interfaces/form.interface';
import { DefaultFormLabelsPolicy } from '../policies/default-form-labels.policy';

/**
 * What the flows that read a form share: the form a workspace is on, which is the coach's own current
 * version if they wrote one and the built-in form (in the workspace's units) if not, in the shape the
 * answers are checked against and in the shape the coach's builder edits.
 */
export abstract class BaseFormOrchestrator {
  constructor(
    protected readonly formsQuery: FormsQueryHandler,
    protected readonly intakeForm: IntakeFormPolicy,
    protected readonly checkinForm: CheckinFormPolicy,
    protected readonly labels: DefaultFormLabelsPolicy,
    protected readonly transactions: TransactionManager,
  ) {}

  /** The form to ask: the coach's current version, or the built-in one. */
  protected async currentForm(
    purpose: FormPurpose,
    unitSystem: UnitSystem,
  ): Promise<IntakeForm> {
    const template = await this.formsQuery.findActive(purpose);
    return template
      ? this.customForm(template, unitSystem)
      : this.builtInForm(purpose, unitSystem);
  }

  protected builtInForm(
    purpose: FormPurpose,
    unitSystem: UnitSystem,
  ): IntakeForm {
    const form =
      purpose === FormPurpose.INTAKE
        ? this.intakeForm.formFor(unitSystem)
        : this.checkinForm.formFor(unitSystem);
    return this.labels.describe(form, purpose);
  }

  protected async customForm(
    template: StoredFormTemplate,
    unitSystem: UnitSystem,
  ): Promise<IntakeForm> {
    const questions = await this.formsQuery.questionsOf(template.id);
    return {
      version: `custom_v${template.version}`,
      templateId: template.id,
      units: this.intakeForm.formFor(unitSystem).units,
      questions: questions.map((question): IntakeQuestion => ({
        id: question.id,
        type: question.inputType,
        required: question.isRequired,
        options: question.options?.map((option) => option.value),
        choices: question.options ?? undefined,
        min: question.min ?? undefined,
        max: question.max ?? undefined,
        integer: question.integer || undefined,
        maxLength: question.maxLength ?? undefined,
        unit: question.unit ?? undefined,
        metric: question.mapsToMetric ?? undefined,
        labelAr: question.labelAr,
        labelEn: question.labelEn ?? undefined,
        helpText: question.helpText ?? undefined,
      })),
    };
  }

  /** What the builder edits: the same questions with their wording, as records. */
  protected record(purpose: FormPurpose, form: IntakeForm): FormRecord {
    return {
      purpose,
      isCustom: form.templateId !== undefined,
      version: form.version,
      templateId: form.templateId ?? null,
      questions: form.questions.map((question, index): FormQuestionRecord => ({
        id: question.id,
        position: index + 1,
        labelAr: question.labelAr ?? question.id,
        labelEn: question.labelEn ?? null,
        helpText: question.helpText ?? null,
        inputType: question.type,
        options: question.choices ?? null,
        isRequired: question.required,
        unit: question.unit ?? null,
        mapsToMetric: question.metric ?? null,
        min: question.min ?? null,
        max: question.max ?? null,
        integer: question.integer ?? false,
        maxLength: question.maxLength ?? null,
      })),
    };
  }
}
