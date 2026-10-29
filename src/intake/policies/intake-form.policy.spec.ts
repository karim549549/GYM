import { UnitSystem } from '../../workspaces/enums/unit-system.enum';
import { QuestionType } from '../enums/question-type.enum';
import { IntakeFormPolicy } from './intake-form.policy';

const policy = new IntakeFormPolicy();
const metric = policy.formFor(UnitSystem.METRIC);
const imperial = policy.formFor(UnitSystem.IMPERIAL);

/** The least a client must answer. */
const required = {
  age: 31,
  gender: 'male',
  height: 178,
  weight: 82.5,
  goal: 'fat_loss',
  experience: 'beginner',
  trainingDays: 3,
  location: 'gym',
};

/** Every question, answered. */
const everything = {
  ...required,
  targetWeight: 75,
  sessionMinutes: 60,
  injuries: ['knee', 'back'],
  injuriesNote: 'Left knee, operated in 2021',
  medications: 'None',
  allergies: ['nuts'],
  foodsAvoided: 'Mushrooms',
  mealsPerDay: 4,
  sleepQuality: 7,
  stressLevel: 4,
};

const problemsOf = (answers: unknown, form = metric) => {
  const result = policy.check(form, answers);
  return result.outcome === 'invalid' ? result.problems : [];
};

describe('IntakeFormPolicy with questions a coach wrote', () => {
  const form = (question: Record<string, unknown>) => ({
    version: 'custom_v1',
    units: { weight: 'kg', height: 'cm' },
    questions: [{ id: 'q1', required: false, ...question }],
  });
  const check = (question: Record<string, unknown>, value: unknown) =>
    policy.check(form(question) as never, { q1: value });

  describe('a dropdown', () => {
    const dropdown = {
      type: QuestionType.DROPDOWN,
      options: ['three', 'four', 'five'],
    };

    it('takes one of its options', () => {
      expect(check(dropdown, 'four')).toMatchObject({
        outcome: 'valid',
        answers: { q1: 'four' },
      });
    });

    it('refuses anything else', () => {
      expect(check(dropdown, 'six').outcome).toBe('invalid');
      expect(check(dropdown, ['four']).outcome).toBe('invalid');
    });
  });

  describe('a date', () => {
    const date = { type: QuestionType.DATE };

    it('takes a real calendar day', () => {
      expect(check(date, '1994-03-21')).toMatchObject({
        outcome: 'valid',
        answers: { q1: '1994-03-21' },
      });
    });

    it.each([
      ['a day that does not exist', '2027-02-30'],
      ['a date with a time', '2027-02-10T10:00:00Z'],
      ['words', 'yesterday'],
      ['a number', 20270210],
    ])('refuses %s', (_label, value) => {
      expect(check(date, value).outcome).toBe('invalid');
    });
  });

  describe('a yes or no', () => {
    const yesNo = { type: QuestionType.BOOLEAN };

    it('takes true and false, and keeps false as an answer', () => {
      expect(check(yesNo, true)).toMatchObject({ answers: { q1: true } });
      expect(check(yesNo, false)).toMatchObject({
        outcome: 'valid',
        answers: { q1: false },
      });
    });

    it('refuses anything that is not a yes or a no', () => {
      expect(check(yesNo, 'yes').outcome).toBe('invalid');
      expect(check(yesNo, 1).outcome).toBe('invalid');
    });

    it('asks for it when required, since a no is an answer but nothing is not', () => {
      const required = { ...yesNo, required: true };

      expect(policy.check(form(required) as never, {}).outcome).toBe('invalid');
      expect(check(required, false).outcome).toBe('valid');
    });
  });
});

describe('IntakeFormPolicy', () => {
  describe('the form', () => {
    it('is the default template, version one', () => {
      expect(metric.version).toBe('default_v1');
    });

    it('asks what any coach needs, in the order the product describes', () => {
      expect(metric.questions.map((q) => q.id)).toEqual([
        'age',
        'gender',
        'height',
        'weight',
        'targetWeight',
        'goal',
        'experience',
        'trainingDays',
        'sessionMinutes',
        'location',
        'injuries',
        'injuriesNote',
        'medications',
        'allergies',
        'foodsAvoided',
        'mealsPerDay',
        'sleepQuality',
        'stressLevel',
      ]);
    });

    it('requires the basics, the goal, the experience, the days and the place', () => {
      expect(
        metric.questions.filter((q) => q.required).map((q) => q.id),
      ).toEqual([
        'age',
        'gender',
        'height',
        'weight',
        'goal',
        'experience',
        'trainingDays',
        'location',
      ]);
    });

    it('uses kilograms and centimetres for a metric workspace', () => {
      expect(metric.units).toEqual({ weight: 'kg', height: 'cm' });
    });

    it('uses pounds and inches for an imperial workspace', () => {
      expect(imperial.units).toEqual({ weight: 'lb', height: 'in' });
    });

    it('gives every question a type', () => {
      for (const question of metric.questions) {
        expect(Object.values(QuestionType)).toContain(question.type);
      }
    });

    it('hands out a fresh form each time, so nobody can change the questions for the next client', () => {
      policy.formFor(UnitSystem.METRIC).questions.pop();

      expect(policy.formFor(UnitSystem.METRIC).questions).toHaveLength(18);
    });
  });

  describe('a valid set of answers', () => {
    it('is accepted when only the required questions are answered', () => {
      expect(policy.check(metric, required)).toMatchObject({
        outcome: 'valid',
        answers: required,
      });
    });

    it('is accepted when every question is answered', () => {
      expect(policy.check(metric, everything)).toMatchObject({
        outcome: 'valid',
        answers: everything,
      });
    });

    it('turns the numbers that charts need into readings, with the workspace’s units', () => {
      const result = policy.check(metric, everything);

      expect(result).toMatchObject({
        outcome: 'valid',
        readings: expect.arrayContaining([
          { metric: 'weight', value: 82.5, unit: 'kg' },
          { metric: 'height', value: 178, unit: 'cm' },
          { metric: 'target_weight', value: 75, unit: 'kg' },
          { metric: 'sleep_quality', value: 7, unit: 'score' },
          { metric: 'stress_level', value: 4, unit: 'score' },
        ]),
      });
      expect((result as { readings: unknown[] }).readings).toHaveLength(5);
    });

    it('makes readings only of what was answered', () => {
      const result = policy.check(metric, required);

      const { readings } = result as { readings: unknown[] };
      expect(readings).toHaveLength(2);
      expect(readings).toEqual(
        expect.arrayContaining([
          { metric: 'weight', value: 82.5, unit: 'kg' },
          { metric: 'height', value: 178, unit: 'cm' },
        ]),
      );
    });

    it('labels the readings in pounds and inches for an imperial workspace', () => {
      const result = policy.check(imperial, {
        ...required,
        height: 70,
        weight: 180,
      });

      const { readings } = result as { readings: unknown[] };
      expect(readings).toHaveLength(2);
      expect(readings).toEqual(
        expect.arrayContaining([
          { metric: 'weight', value: 180, unit: 'lb' },
          { metric: 'height', value: 70, unit: 'in' },
        ]),
      );
    });

    it('keeps text without the spaces around it', () => {
      const result = policy.check(metric, {
        ...required,
        medications: '  Vitamin D  ',
      });

      expect(result).toMatchObject({
        answers: { medications: 'Vitamin D' },
      });
    });

    it('treats an empty optional answer as not answered', () => {
      const result = policy.check(metric, {
        ...required,
        medications: '   ',
        injuries: [],
        targetWeight: null,
      });

      expect(result.outcome).toBe('valid');
      expect((result as { answers: object }).answers).toEqual(required);
    });

    it('does not change what it was given', () => {
      const given = { ...required, medications: '  x  ' };
      const copy = structuredClone(given);

      policy.check(metric, given);

      expect(given).toEqual(copy);
    });

    it('accepts a lone "none" for injuries and allergies', () => {
      expect(
        policy.check(metric, {
          ...required,
          injuries: ['none'],
          allergies: ['none'],
        }).outcome,
      ).toBe('valid');
    });
  });

  describe('answers that are not accepted', () => {
    it.each([
      'age',
      'gender',
      'height',
      'weight',
      'goal',
      'experience',
      'trainingDays',
      'location',
    ])('asks for %s when it is missing', (id) => {
      const answers: Record<string, unknown> = { ...required };
      delete answers[id];

      expect(problemsOf(answers)).toEqual([`${id}: required`]);
    });

    it.each(['age', 'goal'])('asks for %s when it is empty or null', (id) => {
      expect(problemsOf({ ...required, [id]: '' })).toEqual([
        `${id}: required`,
      ]);
      expect(problemsOf({ ...required, [id]: null })).toEqual([
        `${id}: required`,
      ]);
    });

    it('reports every problem at once, not just the first', () => {
      expect(
        problemsOf({ ...required, age: 3, goal: 'win', weight: 'heavy' }),
      ).toEqual(
        expect.arrayContaining([
          'age: invalid',
          'goal: invalid',
          'weight: invalid',
        ]),
      );
    });

    it('refuses a question the form does not have', () => {
      expect(problemsOf({ ...required, shoeSize: 43 })).toEqual([
        'shoeSize: unknown',
      ]);
    });

    it.each([
      ['nothing', undefined],
      ['null', null],
      ['text', 'hello'],
      ['a list', [1, 2]],
      ['a number', 42],
    ])('refuses answers that are %s', (_label, answers) => {
      expect(problemsOf(answers)).toEqual(['answers: invalid']);
    });

    it.each([
      ['age', 9],
      ['age', 101],
      ['age', 30.5],
      ['age', '30'],
      ['height', 79],
      ['height', 261],
      ['weight', 19.9],
      ['weight', 400.1],
      ['weight', '82'],
      ['weight', Number.NaN],
      ['trainingDays', 0],
      ['trainingDays', 8],
      ['trainingDays', 2.5],
      ['sessionMinutes', 9],
      ['sessionMinutes', 241],
      ['mealsPerDay', 0],
      ['mealsPerDay', 9],
      ['sleepQuality', 0],
      ['sleepQuality', 11],
      ['sleepQuality', 5.5],
      ['stressLevel', 'high'],
    ])('refuses %s = %p', (id, value) => {
      expect(problemsOf({ ...required, [id]: value })).toEqual([
        `${id}: invalid`,
      ]);
    });

    it('measures a metric workspace in kilograms and an imperial one in pounds', () => {
      // 30 is a believable body weight in kilograms only, 30 pounds is not
      expect(problemsOf({ ...required, weight: 30 }, metric)).toEqual([]);
      expect(
        problemsOf({ ...required, height: 70, weight: 30 }, imperial),
      ).toEqual(['weight: invalid']);
      // 60 inches is a height, 60 centimetres is not
      expect(problemsOf({ ...required, height: 60 }, imperial)).toEqual([]);
      expect(problemsOf({ ...required, height: 60 }, metric)).toEqual([
        'height: invalid',
      ]);
    });

    it.each([
      ['gender', 'robot'],
      ['goal', 'win'],
      ['experience', 'wizard'],
      ['location', 'moon'],
      ['gender', 1],
      ['goal', ['fat_loss']],
    ])('refuses %s = %p', (id, value) => {
      expect(problemsOf({ ...required, [id]: value })).toEqual([
        `${id}: invalid`,
      ]);
    });

    it.each([
      ['an option that is not offered', ['knee', 'elbow']],
      ['the same option twice', ['knee', 'knee']],
      ['"none" together with something else', ['none', 'knee']],
      ['text instead of a list', 'knee'],
      ['a list of numbers', [1, 2]],
    ])('refuses injuries with %s', (_label, value) => {
      expect(problemsOf({ ...required, injuries: value })).toEqual([
        'injuries: invalid',
      ]);
    });

    it.each([
      ['injuriesNote', 1001],
      ['medications', 301],
      ['foodsAvoided', 301],
    ])('refuses %s over %i characters', (id, length) => {
      expect(problemsOf({ ...required, [id]: 'x'.repeat(length) })).toEqual([
        `${id}: invalid`,
      ]);
    });

    it('refuses text where text is not text', () => {
      expect(problemsOf({ ...required, medications: 42 })).toEqual([
        'medications: invalid',
      ]);
    });
  });
});
