import { UnitSystem } from '../../workspaces/enums/unit-system.enum';
import { CheckinFormPolicy } from './checkin-form.policy';

const policy = new CheckinFormPolicy();
const metric = policy.formFor(UnitSystem.METRIC);
const imperial = policy.formFor(UnitSystem.IMPERIAL);

describe('CheckinFormPolicy', () => {
  it('is the default check-in, version one', () => {
    expect(metric.version).toBe('checkin_v1');
  });

  it('asks only for the weight and the two adherence counts, so it takes under two minutes', () => {
    expect(metric.questions.filter((q) => q.required).map((q) => q.id)).toEqual(
      ['weight', 'nutritionDays', 'trainingDays'],
    );
  });

  it('asks for the product’s suggested questions, in order', () => {
    expect(metric.questions.map((q) => q.id)).toEqual([
      'weight',
      'waist',
      'chest',
      'arm',
      'nutritionDays',
      'trainingDays',
      'sleepQuality',
      'energyLevel',
      'pain',
      'painNote',
      'note',
    ]);
  });

  it('measures in kilograms and centimetres, or pounds and inches, as the workspace does', () => {
    expect(metric.units).toEqual({ weight: 'kg', height: 'cm' });
    expect(imperial.units).toEqual({ weight: 'lb', height: 'in' });
    expect(imperial.questions.find((q) => q.id === 'waist')?.unit).toBe('in');
  });

  it('turns the numbers a chart needs into measurements', () => {
    const metrics = metric.questions
      .filter((q) => q.metric)
      .map((q) => q.metric);

    expect(metrics).toEqual([
      'weight',
      'waist',
      'chest',
      'arm',
      'sleep_quality',
      'energy_level',
    ]);
  });

  it('counts days of the week from zero to seven', () => {
    const days = metric.questions.find((q) => q.id === 'nutritionDays');

    expect(days).toMatchObject({ min: 0, max: 7, integer: true });
  });

  it('hands out a fresh form each time', () => {
    policy.formFor(UnitSystem.METRIC).questions.pop();

    expect(policy.formFor(UnitSystem.METRIC).questions).toHaveLength(11);
  });
});
