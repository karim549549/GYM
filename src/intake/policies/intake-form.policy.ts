import { Injectable } from '@nestjs/common';
import { isISO8601 } from 'class-validator';
import type { Reading } from '../../measurements/interfaces/reading.interface';
import { UnitSystem } from '../../workspaces/enums/unit-system.enum';
import { QuestionType } from '../enums/question-type.enum';
import type {
  IntakeCheck,
  IntakeForm,
  IntakeQuestion,
} from '../interfaces/intake-form.interface';

/**
 * The intake form every coach starts with (the form builder comes later), and the rule for what
 * counts as a good answer to it. The questions depend on the workspace's units: the same body
 * weight is a different number in kilograms and in pounds, so the believable range is too.
 */
@Injectable()
export class IntakeFormPolicy {
  static readonly VERSION = 'default_v1';

  formFor(unitSystem: UnitSystem): IntakeForm {
    const imperial = unitSystem === UnitSystem.IMPERIAL;
    const units = imperial
      ? { weight: 'lb', height: 'in' }
      : { weight: 'kg', height: 'cm' };
    const weight = imperial ? { min: 44, max: 880 } : { min: 20, max: 400 };
    const height = imperial ? { min: 30, max: 100 } : { min: 80, max: 260 };
    const text = (
      id: string,
      type: QuestionType,
      maxLength: number,
    ): IntakeQuestion => ({
      id,
      type,
      required: false,
      maxLength,
    });

    return {
      version: IntakeFormPolicy.VERSION,
      units,
      questions: [
        {
          id: 'age',
          type: QuestionType.NUMBER,
          required: true,
          integer: true,
          min: 10,
          max: 100,
          unit: 'years',
        },
        {
          id: 'gender',
          type: QuestionType.SINGLE_SELECT,
          required: true,
          options: ['male', 'female'],
        },
        {
          id: 'height',
          type: QuestionType.NUMBER,
          required: true,
          ...height,
          unit: units.height,
          metric: 'height',
        },
        {
          id: 'weight',
          type: QuestionType.NUMBER,
          required: true,
          ...weight,
          unit: units.weight,
          metric: 'weight',
        },
        {
          id: 'targetWeight',
          type: QuestionType.NUMBER,
          required: false,
          ...weight,
          unit: units.weight,
          metric: 'target_weight',
        },
        {
          id: 'goal',
          type: QuestionType.SINGLE_SELECT,
          required: true,
          options: [
            'fat_loss',
            'muscle_gain',
            'general_fitness',
            'injury_rehab',
          ],
        },
        {
          id: 'experience',
          type: QuestionType.SINGLE_SELECT,
          required: true,
          options: ['beginner', 'intermediate', 'advanced'],
        },
        {
          id: 'trainingDays',
          type: QuestionType.NUMBER,
          required: true,
          integer: true,
          min: 1,
          max: 7,
        },
        {
          id: 'sessionMinutes',
          type: QuestionType.NUMBER,
          required: false,
          integer: true,
          min: 10,
          max: 240,
          unit: 'minutes',
        },
        {
          id: 'location',
          type: QuestionType.SINGLE_SELECT,
          required: true,
          options: ['gym', 'home', 'both'],
        },
        {
          id: 'injuries',
          type: QuestionType.MULTI_SELECT,
          required: false,
          options: [
            'knee',
            'back',
            'shoulder',
            'neck',
            'heart_condition',
            'diabetes',
            'high_blood_pressure',
            'none',
          ],
        },
        text('injuriesNote', QuestionType.LONG_TEXT, 1000),
        text('medications', QuestionType.SHORT_TEXT, 300),
        {
          id: 'allergies',
          type: QuestionType.MULTI_SELECT,
          required: false,
          options: ['gluten', 'dairy', 'nuts', 'eggs', 'seafood', 'none'],
        },
        text('foodsAvoided', QuestionType.SHORT_TEXT, 300),
        {
          id: 'mealsPerDay',
          type: QuestionType.NUMBER,
          required: false,
          integer: true,
          min: 1,
          max: 8,
        },
        {
          id: 'sleepQuality',
          type: QuestionType.SCALE,
          required: false,
          integer: true,
          min: 1,
          max: 10,
          unit: 'score',
          metric: 'sleep_quality',
        },
        {
          id: 'stressLevel',
          type: QuestionType.SCALE,
          required: false,
          integer: true,
          min: 1,
          max: 10,
          unit: 'score',
          metric: 'stress_level',
        },
      ],
    };
  }

  /** Every problem at once, so the person fixes them in one go. Never changes what it is given. */
  check(form: IntakeForm, given: unknown): IntakeCheck {
    if (typeof given !== 'object' || given === null || Array.isArray(given)) {
      return { outcome: 'invalid', problems: ['answers: invalid'] };
    }
    const answers = given as Record<string, unknown>;
    const known = new Set(form.questions.map((question) => question.id));
    const problems = Object.keys(answers)
      .filter((key) => !known.has(key))
      .map((key) => `${key}: unknown`);

    const kept: Record<string, unknown> = {};
    const readings: Reading[] = [];
    for (const question of form.questions) {
      const raw = answers[question.id];
      if (this.isBlank(raw)) {
        if (question.required) {
          problems.push(`${question.id}: required`);
        }
        continue;
      }

      const value = this.accept(question, raw);
      if (value === undefined) {
        problems.push(`${question.id}: invalid`);
        continue;
      }
      kept[question.id] = value;
      if (question.metric && typeof value === 'number') {
        readings.push({
          metric: question.metric,
          value,
          unit: question.unit ?? '',
        });
      }
    }

    return problems.length > 0
      ? { outcome: 'invalid', problems }
      : { outcome: 'valid', answers: kept, readings };
  }

  /** Nothing was answered: left out, null, only spaces, or no choice made. */
  private isBlank(value: unknown): boolean {
    return (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0)
    );
  }

  /** The answer as it should be kept, or undefined when it is not a good answer to the question. */
  private accept(question: IntakeQuestion, value: unknown): unknown {
    switch (question.type) {
      case QuestionType.NUMBER:
      case QuestionType.SCALE:
        return this.acceptNumber(question, value);
      case QuestionType.SINGLE_SELECT:
      case QuestionType.DROPDOWN:
        return typeof value === 'string' && question.options?.includes(value)
          ? value
          : undefined;
      case QuestionType.DATE:
        return this.acceptDate(value);
      case QuestionType.BOOLEAN:
        return typeof value === 'boolean' ? value : undefined;
      case QuestionType.MULTI_SELECT:
        return this.acceptChoices(question, value);
      case QuestionType.SHORT_TEXT:
      case QuestionType.LONG_TEXT:
        return this.acceptText(question, value);
      case QuestionType.IMAGE:
        // TODO: Implement
        // photos need their own private bucket flow (own endpoint, signed links); a bare value is never trusted
        return undefined;
    }
  }

  /** A real calendar day as YYYY-MM-DD: not a date with a time, and not one that does not exist. */
  private acceptDate(value: unknown): string | undefined {
    return typeof value === 'string' &&
      value.length === 10 &&
      isISO8601(value, { strict: true })
      ? value
      : undefined;
  }

  private acceptNumber(
    question: IntakeQuestion,
    value: unknown,
  ): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return undefined;
    }
    if (question.integer && !Number.isInteger(value)) {
      return undefined;
    }
    const inRange =
      (question.min === undefined || value >= question.min) &&
      (question.max === undefined || value <= question.max);
    return inRange ? value : undefined;
  }

  private acceptChoices(
    question: IntakeQuestion,
    value: unknown,
  ): string[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }
    const allowed = value.every(
      (choice) =>
        typeof choice === 'string' && question.options?.includes(choice),
    );
    const noRepeats = new Set(value).size === value.length;
    // "none" means none of the others, so it cannot sit beside them
    const noneAlone = !value.includes('none') || value.length === 1;
    return allowed && noRepeats && noneAlone ? (value as string[]) : undefined;
  }

  private acceptText(
    question: IntakeQuestion,
    value: unknown,
  ): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const text = value.trim();
    return text.length <= (question.maxLength ?? 0) ? text : undefined;
  }
}
