import { Injectable } from '@nestjs/common';
import { QuestionType } from '../../intake/enums/question-type.enum';
import type {
  FormQuestionInput,
  StoredFormQuestion,
} from '../interfaces/form.interface';

export type FormDefinitionCheck =
  | { outcome: 'valid'; questions: StoredFormQuestion[] }
  | { outcome: 'invalid'; problems: string[] };

/**
 * What makes a form a coach wrote usable, beyond each field being well formed. A select needs options
 * to choose from, a range must not contradict itself, and a number tagged as a measurement must be
 * one the product keeps and say what it is measured in, or the coach's own charts would break the day
 * they rewrote their form. Every problem at once, so the coach fixes them in one go.
 */
@Injectable()
export class FormDefinitionPolicy {
  private static readonly MAX_QUESTIONS = 60;
  private static readonly MAX_LABEL = 200;
  private static readonly SHORT_TEXT = 300;
  private static readonly LONG_TEXT = 2000;

  /** The measurements a question can be tagged with: the ones the charts and analytics read. */
  static readonly METRICS = [
    'weight',
    'height',
    'target_weight',
    'waist',
    'chest',
    'arm',
    'sleep_quality',
    'stress_level',
    'energy_level',
  ];

  check(questions: FormQuestionInput[]): FormDefinitionCheck {
    const problems: string[] = [];
    if (questions.length === 0) {
      return { outcome: 'invalid', problems: ['questions: at least one'] };
    }
    if (questions.length > FormDefinitionPolicy.MAX_QUESTIONS) {
      return {
        outcome: 'invalid',
        problems: [`questions: at most ${FormDefinitionPolicy.MAX_QUESTIONS}`],
      };
    }

    const usedMetrics = new Set<string>();
    const stored = questions.map((question, index) =>
      this.one(question, `questions[${index}]`, usedMetrics, problems),
    );

    return problems.length > 0
      ? { outcome: 'invalid', problems }
      : { outcome: 'valid', questions: stored };
  }

  private one(
    question: FormQuestionInput,
    where: string,
    usedMetrics: Set<string>,
    problems: string[],
  ): StoredFormQuestion {
    const label = question.labelAr.trim();
    if (label === '') {
      problems.push(`${where}.labelAr: required`);
    } else if (label.length > FormDefinitionPolicy.MAX_LABEL) {
      problems.push(`${where}.labelAr: too long`);
    }

    const type = question.inputType;
    const isSelect = [
      QuestionType.SINGLE_SELECT,
      QuestionType.MULTI_SELECT,
      QuestionType.DROPDOWN,
    ].includes(type);
    const isNumeric = type === QuestionType.NUMBER;
    const isScale = type === QuestionType.SCALE;
    const isText = [QuestionType.SHORT_TEXT, QuestionType.LONG_TEXT].includes(
      type,
    );

    this.options(question, isSelect, where, problems);

    if (!isNumeric && !isScale && question.unit !== undefined) {
      problems.push(`${where}.unit: only for a number`);
    }
    if (!isNumeric && !isScale && question.integer !== undefined) {
      problems.push(`${where}.integer: only for a number`);
    }
    if (
      !isNumeric &&
      (question.min !== undefined || question.max !== undefined)
    ) {
      if (!isScale) {
        problems.push(`${where}.min: only for a number`);
      }
    }
    if (
      isNumeric &&
      question.min !== undefined &&
      question.max !== undefined &&
      question.min > question.max
    ) {
      problems.push(`${where}.min: more than the largest`);
    }

    const metric = this.metric(
      question,
      isNumeric || isScale,
      where,
      usedMetrics,
      problems,
    );

    return {
      labelAr: label,
      labelEn: question.labelEn?.trim() || null,
      helpText: question.helpText?.trim() || null,
      inputType: type,
      options: isSelect ? this.cleanOptions(question) : null,
      isRequired: question.isRequired ?? false,
      unit: isScale && metric ? 'score' : (question.unit?.trim() ?? null),
      mapsToMetric: metric,
      min: isScale ? 1 : (question.min ?? null),
      max: isScale ? 10 : (question.max ?? null),
      integer: isScale ? true : (question.integer ?? false),
      maxLength: isText ? this.maxLength(question) : null,
    };
  }

  private options(
    question: FormQuestionInput,
    isSelect: boolean,
    where: string,
    problems: string[],
  ): void {
    if (!isSelect) {
      if (question.options !== undefined) {
        problems.push(`${where}.options: only for a select`);
      }
      return;
    }
    const options = question.options ?? [];
    if (options.length < 2 || options.length > 30) {
      problems.push(`${where}.options: between 2 and 30`);
      return;
    }
    const seen = new Set<string>();
    options.forEach((option, index) => {
      if (seen.has(option.value)) {
        problems.push(`${where}.options[${index}]: duplicate`);
      }
      seen.add(option.value);
    });
  }

  /** The measurement a question is saved as, if it is tagged: one the product keeps, with a unit, used once. */
  private metric(
    question: FormQuestionInput,
    canMeasure: boolean,
    where: string,
    usedMetrics: Set<string>,
    problems: string[],
  ): string | null {
    const metric = question.mapsToMetric;
    if (metric === undefined) {
      return null;
    }
    if (!canMeasure) {
      problems.push(`${where}.mapsToMetric: only for a number`);
    } else if (!FormDefinitionPolicy.METRICS.includes(metric)) {
      problems.push(`${where}.mapsToMetric: unknown`);
    } else if (usedMetrics.has(metric)) {
      problems.push(`${where}.mapsToMetric: already used`);
    } else if (
      question.inputType === QuestionType.NUMBER &&
      !question.unit?.trim()
    ) {
      problems.push(`${where}.unit: needed for a measurement`);
    }
    usedMetrics.add(metric);
    return metric;
  }

  private cleanOptions(question: FormQuestionInput) {
    return (question.options ?? []).map((option) => ({
      value: option.value,
      labelAr: option.labelAr.trim(),
    }));
  }

  private maxLength(question: FormQuestionInput): number {
    if (question.maxLength !== undefined) {
      return question.maxLength;
    }
    return question.inputType === QuestionType.LONG_TEXT
      ? FormDefinitionPolicy.LONG_TEXT
      : FormDefinitionPolicy.SHORT_TEXT;
  }
}
