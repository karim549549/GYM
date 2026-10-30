import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  max,
} from 'drizzle-orm';
import { BaseQueryHandler } from '../../common/handlers/base-query.handler';
import {
  formQuestions,
  formTemplates,
  namedForms,
} from '../../database/schema';
import type { FormPurpose } from '../enums/form-purpose.enum';
import type {
  FormQuestionRecord,
  NamedFormSummary,
  StoredFormQuestion,
  StoredFormTemplate,
  StoredNamedForm,
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
          isNull(formTemplates.namedFormId),
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
      .where(
        and(
          eq(formTemplates.purpose, purpose),
          isNull(formTemplates.namedFormId),
        ),
      );
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
          isNull(formTemplates.namedFormId),
        ),
      );
  }

  async insertTemplate(
    workspaceId: string,
    purpose: FormPurpose,
    version: number,
    namedFormId: string | null = null,
  ): Promise<string> {
    const [created] = await this.db
      .insert(formTemplates)
      .values({ workspaceId, purpose, version, namedFormId })
      .returning({ id: formTemplates.id });
    return created.id;
  }

  // ---- named forms: the coach's library of forms, each with its own versions ----

  /** The coach's forms that are not archived, oldest first, each with the version in use. */
  async listNamed(purpose?: FormPurpose): Promise<NamedFormSummary[]> {
    const forms = await this.db
      .select({
        id: namedForms.id,
        purpose: namedForms.purpose,
        name: namedForms.name,
      })
      .from(namedForms)
      .where(
        and(
          isNull(namedForms.archivedAt),
          purpose ? eq(namedForms.purpose, purpose) : undefined,
        ),
      )
      .orderBy(asc(namedForms.createdAt));
    if (forms.length === 0) {
      return [];
    }
    const versions = await this.db
      .select({
        id: formTemplates.id,
        namedFormId: formTemplates.namedFormId,
        version: formTemplates.version,
      })
      .from(formTemplates)
      .where(
        and(
          eq(formTemplates.isActive, true),
          inArray(
            formTemplates.namedFormId,
            forms.map((form) => form.id),
          ),
        ),
      );
    const counts = await this.db
      .select({ templateId: formQuestions.templateId, total: count() })
      .from(formQuestions)
      .where(
        inArray(
          formQuestions.templateId,
          versions.map((version) => version.id),
        ),
      )
      .groupBy(formQuestions.templateId);
    const countOf = new Map(counts.map((row) => [row.templateId, row.total]));
    const versionOf = new Map(
      versions.map((row) => [row.namedFormId, row] as const),
    );
    return forms.map((form) => {
      const active = versionOf.get(form.id);
      return {
        ...form,
        version: active?.version ?? 1,
        questionCount: active ? (countOf.get(active.id) ?? 0) : 0,
      };
    });
  }

  /** Archived or not: a link already sent still reaches its form. */
  async findNamed(id: string): Promise<StoredNamedForm | null> {
    const rows = await this.db
      .select({
        id: namedForms.id,
        purpose: namedForms.purpose,
        name: namedForms.name,
      })
      .from(namedForms)
      .where(eq(namedForms.id, id))
      .limit(1);
    return this.firstOrNull(rows);
  }

  async insertNamed(
    workspaceId: string,
    purpose: FormPurpose,
    name: string,
  ): Promise<StoredNamedForm> {
    const [created] = await this.db
      .insert(namedForms)
      .values({ workspaceId, purpose, name })
      .returning({
        id: namedForms.id,
        purpose: namedForms.purpose,
        name: namedForms.name,
      });
    return created;
  }

  async renameNamed(id: string, name: string): Promise<void> {
    await this.db.update(namedForms).set({ name }).where(eq(namedForms.id, id));
  }

  /** False when it is not visible, which includes another workspace's, or was archived already. */
  async archiveNamed(id: string): Promise<boolean> {
    const rows = await this.db
      .update(namedForms)
      .set({ archivedAt: new Date() })
      .where(and(eq(namedForms.id, id), isNull(namedForms.archivedAt)))
      .returning({ id: namedForms.id });
    return rows.length > 0;
  }

  /** The version of a named form in use. */
  async findActiveOf(namedFormId: string): Promise<StoredFormTemplate | null> {
    const rows = await this.db
      .select(TEMPLATE)
      .from(formTemplates)
      .where(
        and(
          eq(formTemplates.namedFormId, namedFormId),
          eq(formTemplates.isActive, true),
        ),
      )
      .orderBy(desc(formTemplates.version))
      .limit(1);
    return this.firstOrNull(rows);
  }

  async nextVersionOf(namedFormId: string): Promise<number> {
    const [row] = await this.db
      .select({ last: max(formTemplates.version) })
      .from(formTemplates)
      .where(eq(formTemplates.namedFormId, namedFormId));
    return (row?.last ?? 0) + 1;
  }

  async deactivateCurrentOf(namedFormId: string): Promise<void> {
    await this.db
      .update(formTemplates)
      .set({ isActive: false })
      .where(
        and(
          eq(formTemplates.namedFormId, namedFormId),
          eq(formTemplates.isActive, true),
          isNotNull(formTemplates.namedFormId),
        ),
      );
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
