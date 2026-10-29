import { Injectable } from '@nestjs/common';
import { QuestionType } from '../../intake/enums/question-type.enum';
import type {
  IntakeForm,
  IntakeQuestion,
} from '../../intake/interfaces/intake-form.interface';
import { UnitSystem } from '../../workspaces/enums/unit-system.enum';

/**
 * The check-in every coach starts with: the product's suggested questions, short enough to answer
 * in under two minutes, so only the weight and the two adherence counts are required. It has the
 * same shape as the intake form, so one rule judges the answers to both. Photos come later, with
 * their own private storage.
 */
@Injectable()
export class CheckinFormPolicy {
  static readonly VERSION = 'checkin_v1';

  formFor(unitSystem: UnitSystem): IntakeForm {
    const imperial = unitSystem === UnitSystem.IMPERIAL;
    const units = imperial
      ? { weight: 'lb', height: 'in' }
      : { weight: 'kg', height: 'cm' };
    const weight = imperial ? { min: 44, max: 880 } : { min: 20, max: 400 };
    const girth = imperial ? { min: 4, max: 120 } : { min: 10, max: 300 };

    const days = (id: string): IntakeQuestion => ({
      id,
      type: QuestionType.NUMBER,
      required: true,
      integer: true,
      min: 0,
      max: 7,
    });
    const scale = (id: string, metric: string): IntakeQuestion => ({
      id,
      type: QuestionType.SCALE,
      required: false,
      integer: true,
      min: 1,
      max: 10,
      unit: 'score',
      metric,
    });
    const girthOf = (id: string): IntakeQuestion => ({
      id,
      type: QuestionType.NUMBER,
      required: false,
      ...girth,
      unit: units.height,
      metric: id,
    });

    return {
      version: CheckinFormPolicy.VERSION,
      units,
      questions: [
        {
          id: 'weight',
          type: QuestionType.NUMBER,
          required: true,
          ...weight,
          unit: units.weight,
          metric: 'weight',
        },
        girthOf('waist'),
        girthOf('chest'),
        girthOf('arm'),
        days('nutritionDays'),
        days('trainingDays'),
        scale('sleepQuality', 'sleep_quality'),
        scale('energyLevel', 'energy_level'),
        {
          id: 'pain',
          type: QuestionType.SINGLE_SELECT,
          required: false,
          options: ['yes', 'no'],
        },
        {
          id: 'painNote',
          type: QuestionType.LONG_TEXT,
          required: false,
          maxLength: 1000,
        },
        {
          id: 'note',
          type: QuestionType.LONG_TEXT,
          required: false,
          maxLength: 1000,
        },
      ],
    };
  }
}
