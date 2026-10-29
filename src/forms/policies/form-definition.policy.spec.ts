import { QuestionType } from '../../intake/enums/question-type.enum';
import type { FormQuestionInput } from '../interfaces/form.interface';
import { FormDefinitionPolicy } from './form-definition.policy';

const policy = new FormDefinitionPolicy();

const text = (
  overrides: Partial<FormQuestionInput> = {},
): FormQuestionInput => ({
  labelAr: 'سؤال',
  inputType: QuestionType.SHORT_TEXT,
  ...overrides,
});
const choice = (
  overrides: Partial<FormQuestionInput> = {},
): FormQuestionInput => ({
  labelAr: 'اختر',
  inputType: QuestionType.SINGLE_SELECT,
  options: [
    { value: 'a', labelAr: 'أ' },
    { value: 'b', labelAr: 'ب' },
  ],
  ...overrides,
});
const number = (
  overrides: Partial<FormQuestionInput> = {},
): FormQuestionInput => ({
  labelAr: 'رقم',
  inputType: QuestionType.NUMBER,
  ...overrides,
});
const problemsOf = (questions: FormQuestionInput[]) => {
  const result = policy.check(questions);
  return result.outcome === 'invalid' ? result.problems : [];
};

describe('FormDefinitionPolicy', () => {
  it('accepts a form of questions of every kind', () => {
    expect(
      policy.check([
        text(),
        text({ inputType: QuestionType.LONG_TEXT }),
        number({ min: 1, max: 10 }),
        choice(),
        choice({ inputType: QuestionType.MULTI_SELECT }),
        choice({ inputType: QuestionType.DROPDOWN }),
        { labelAr: 'تاريخ', inputType: QuestionType.DATE },
        { labelAr: 'نعم أو لا', inputType: QuestionType.BOOLEAN },
        { labelAr: 'قيّم', inputType: QuestionType.SCALE },
      ]).outcome,
    ).toBe('valid');
  });

  it('keeps a question as written, filling in what was left out', () => {
    const result = policy.check([text({ labelAr: '  اسمك  ' })]);

    expect(result).toEqual({
      outcome: 'valid',
      questions: [
        {
          labelAr: 'اسمك',
          labelEn: null,
          helpText: null,
          inputType: QuestionType.SHORT_TEXT,
          options: null,
          isRequired: false,
          unit: null,
          mapsToMetric: null,
          min: null,
          max: null,
          integer: false,
          maxLength: 300,
        },
      ],
    });
  });

  it('gives a long text more room than a short one', () => {
    const result = policy.check([
      text(),
      text({ inputType: QuestionType.LONG_TEXT }),
    ]);

    expect(result).toMatchObject({
      questions: [{ maxLength: 300 }, { maxLength: 2000 }],
    });
  });

  it('makes a scale a whole number from 1 to 10, whatever was asked', () => {
    const result = policy.check([
      { labelAr: 'قيّم', inputType: QuestionType.SCALE, min: 0, max: 100 },
    ]);

    expect(result).toMatchObject({
      questions: [{ min: 1, max: 10, integer: true }],
    });
  });

  it('refuses a form with no questions, or more than sixty', () => {
    expect(problemsOf([])).toEqual(['questions: at least one']);
    expect(problemsOf(Array.from({ length: 61 }, () => text()))).toEqual([
      'questions: at most 60',
    ]);
  });

  it('refuses a select with fewer than two options, or more than thirty', () => {
    expect(
      problemsOf([choice({ options: [{ value: 'a', labelAr: 'أ' }] })]),
    ).toEqual(['questions[0].options: between 2 and 30']);
    expect(problemsOf([choice({ options: undefined })])).toEqual([
      'questions[0].options: between 2 and 30',
    ]);
    expect(
      problemsOf([
        choice({
          options: Array.from({ length: 31 }, (_o, i) => ({
            value: `v${i}`,
            labelAr: 'x',
          })),
        }),
      ]),
    ).toEqual(['questions[0].options: between 2 and 30']);
  });

  it('refuses options that share a value', () => {
    expect(
      problemsOf([
        choice({
          options: [
            { value: 'a', labelAr: 'أ' },
            { value: 'a', labelAr: 'ب' },
          ],
        }),
      ]),
    ).toEqual(['questions[0].options[1]: duplicate']);
  });

  it('refuses options on a question that is not a select', () => {
    expect(
      problemsOf([text({ options: [{ value: 'a', labelAr: 'أ' }] })]),
    ).toEqual(['questions[0].options: only for a select']);
  });

  it('refuses a smallest number that is more than the largest', () => {
    expect(problemsOf([number({ min: 10, max: 5 })])).toEqual([
      'questions[0].min: more than the largest',
    ]);
  });

  it('refuses a range or a unit on a question that is not a number', () => {
    expect(problemsOf([text({ min: 1 })])).toEqual([
      'questions[0].min: only for a number',
    ]);
    expect(problemsOf([text({ unit: 'kg' })])).toEqual([
      'questions[0].unit: only for a number',
    ]);
  });

  describe('what a number is tagged with', () => {
    it('lets a number be saved as a measurement, with its unit', () => {
      expect(
        policy.check([number({ mapsToMetric: 'weight', unit: 'kg' })]),
      ).toMatchObject({
        outcome: 'valid',
        questions: [{ mapsToMetric: 'weight', unit: 'kg' }],
      });
    });

    it('lets a scale be saved as a measurement without being given a unit', () => {
      expect(
        policy.check([
          {
            labelAr: 'نوم',
            inputType: QuestionType.SCALE,
            mapsToMetric: 'sleep_quality',
          },
        ]),
      ).toMatchObject({
        questions: [{ mapsToMetric: 'sleep_quality', unit: 'score' }],
      });
    });

    it('asks for the unit of a measured number', () => {
      expect(problemsOf([number({ mapsToMetric: 'weight' })])).toEqual([
        'questions[0].unit: needed for a measurement',
      ]);
    });

    it('refuses a measurement nobody keeps', () => {
      expect(
        problemsOf([number({ mapsToMetric: 'shoe_size', unit: 'cm' })]),
      ).toEqual(['questions[0].mapsToMetric: unknown']);
    });

    it('refuses a measurement on a question that is not a number', () => {
      expect(problemsOf([text({ mapsToMetric: 'weight' })])).toEqual([
        'questions[0].mapsToMetric: only for a number',
      ]);
    });

    it('refuses two questions measuring the same thing', () => {
      expect(
        problemsOf([
          number({ mapsToMetric: 'weight', unit: 'kg' }),
          number({ mapsToMetric: 'weight', unit: 'kg' }),
        ]),
      ).toEqual(['questions[1].mapsToMetric: already used']);
    });
  });

  it('refuses a blank question, or one over 200 characters', () => {
    expect(problemsOf([text({ labelAr: '   ' })])).toEqual([
      'questions[0].labelAr: required',
    ]);
    expect(problemsOf([text({ labelAr: 'x'.repeat(201) })])).toEqual([
      'questions[0].labelAr: too long',
    ]);
  });

  it('reports every problem at once', () => {
    expect(
      problemsOf([
        text({ labelAr: ' ' }),
        number({ min: 9, max: 1 }),
        choice({ options: [] }),
      ]).sort(),
    ).toEqual(
      [
        'questions[0].labelAr: required',
        'questions[1].min: more than the largest',
        'questions[2].options: between 2 and 30',
      ].sort(),
    );
  });
});
