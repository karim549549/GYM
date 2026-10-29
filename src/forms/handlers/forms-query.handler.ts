import { Injectable } from '@nestjs/common';
import { and, asc, eq, max } from 'drizzle-orm';
import { BaseQueryHandler } from '../../common/handlers/base-query.handler';
import { formQuestions, formTemplates } from '../../database/schema';
import type { FormPurpose } from '../enums/form-purpose.enum';
import type {
  FormQuestionRecord,
  StoredFormQuestion,
  StoredFormTemplate,
} from '../interfaces/form.interface';

const TEMPLATE = {
  id: formTemplates.id,
  purpose: formTemplates.purpose,
  version: formTemplates.version,
  isActive: formTemplates.isActive,
};

/** Data access for `form_templates` and `form_questions`. Row level security keeps it to one workspace. */
@Injectable()
export class FormsQueryHandler extends BaseQueryHandler {
  /** The version of this purpose in use, if the coach has written one of their own. */
  async findActive(purpose: FormPurpose): Promise<StoredFormTemplate | null> {
    const rows = await this.db
      .select(TEMPLATE)
      .from(formTemplates)
      .where(
        and(
          eq(formTemplates.purpose, purpose),
          eq(formTemplates.isActive, true),
        ),
      )
      .limit(1);
    return this.firstOrNull(rows);
  }

  async findById(id: string): Promise<StoredFormTemplate | null> {
    const rows = await this.db
      .select(TEMPLATE)
      .from(formTemplates)
      .where(eq(formTemplates.id, id))
      .limit(1);
    return this.firstOrNull(rows);
  }

  async questionsOf(templateId: string): Promise<FormQuestionRecord[]> {
    const rows = await this.db
      .select()
      .from(formQuestions)
      .where(eq(formQuestions.templateId, templateId))
      .orderBy(asc(formQuestions.position));
    return rows.map((row) => ({
      id: row.id,
      position: row.position,
      labelAr: row.labelAr,
      labelEn: row.labelEn,
      helpText: row.helpText,
      inputType: row.inputType,
      options: row.options,
      isRequired: row.isRequired,
      unit: row.unit,
      mapsToMetric: row.mapsToMetric,
      min: row.minValue,
      max: row.maxValue,
      integer: row.isInteger,
      maxLength: row.maxLength,
    }));
  }

  /** The number the next version of this purpose gets: editing never changes a row, it adds one. */
  async nextVersion(purpose: FormPurpose): Promise<number> {
    const [row] = await this.db
      .select({ last: max(formTemplates.version) })
      .from(formTemplates)
      .where(eq(formTemplates.purpose, purpose));
    return (row?.last ?? 0) + 1;
  }

  async deactivateCurrent(purpose: FormPurpose): Promise<void> {
    await this.db
      .update(formTemplates)
      .set({ isActive: false })
      .where(
        and(
          eq(formTemplates.purpose, purpose),
          eq(formTemplates.isActive, true),
        ),
      );
  }

  async insertTemplate(
    workspaceId: string,
    purpose: FormPurpose,
    version: number,
  ): Promise<string> {
    const [created] = await this.db
      .insert(formTemplates)
      .values({ workspaceId, purpose, version })
      .returning({ id: formTemplates.id });
    return created.id;
  }

  async insertQuestions(
    workspaceId: string,
    templateId: string,
    questions: StoredFormQuestion[],
  ): Promise<void> {
    await this.db.insert(formQuestions).values(
      questions.map((question, index) => ({
        workspaceId,
        templateId,
        position: index + 1,
        labelAr: question.labelAr,
        labelEn: question.labelEn,
        helpText: question.helpText,
        inputType: question.inputType,
        options: question.options,
        isRequired: question.isRequired,
        unit: question.unit,
        mapsToMetric: question.mapsToMetric,
        minValue: question.min,
        maxValue: question.max,
        isInteger: question.integer,
        maxLength: question.maxLength,
      })),
    );
  }
}
