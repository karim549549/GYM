import type { PlanDayInput } from '../interfaces/plan.interface';
import { PlanStructurePolicy } from './plan-structure.policy';

const policy = new PlanStructurePolicy();

const exercise = (supersetGroup?: string) => ({
  exerciseId: 'e1',
  supersetGroup,
  sets: [{ reps: '10' }],
});
const day = (overrides: Partial<PlanDayInput> = {}): PlanDayInput => ({
  weekNo: 1,
  dayNo: 1,
  exercises: [exercise()],
  ...overrides,
});
const problems = (weeks: number, days: PlanDayInput[]) => {
  const result = policy.check(weeks, days);
  return result.outcome === 'invalid' ? result.problems : [];
};

describe('PlanStructurePolicy', () => {
  it('accepts a plan with days in different weeks and different days', () => {
    expect(
      policy.check(2, [
        day({ weekNo: 1, dayNo: 1 }),
        day({ weekNo: 1, dayNo: 3 }),
        day({ weekNo: 2, dayNo: 1 }),
      ]).outcome,
    ).toBe('valid');
  });

  it('accepts a plan with no days yet, so a draft can be saved empty', () => {
    expect(policy.check(4, []).outcome).toBe('valid');
  });

  it('refuses the same day of the same week twice', () => {
    expect(problems(2, [day(), day()])).toEqual(['days[1]: duplicate']);
  });

  it('allows the same day number in another week', () => {
    expect(problems(2, [day(), day({ weekNo: 2 })])).toEqual([]);
  });

  it('refuses a week beyond the plan’s length', () => {
    expect(problems(2, [day({ weekNo: 3 })])).toEqual([
      'days[0].weekNo: beyond the plan',
    ]);
  });

  it('allows the last week itself', () => {
    expect(problems(2, [day({ weekNo: 2 })])).toEqual([]);
  });

  it('refuses a rest day that has exercises', () => {
    expect(problems(1, [day({ isRest: true })])).toEqual([
      'days[0]: a rest day has no exercises',
    ]);
  });

  it('accepts a rest day with none, and a training day with none yet', () => {
    expect(problems(1, [day({ isRest: true, exercises: [] })])).toEqual([]);
    expect(problems(1, [day({ exercises: [] })])).toEqual([]);
  });

  it('accepts a superset of two or more exercises', () => {
    expect(
      problems(1, [
        day({ exercises: [exercise('A'), exercise('A'), exercise()] }),
      ]),
    ).toEqual([]);
  });

  it('refuses a superset letter used by one exercise alone', () => {
    expect(
      problems(1, [
        day({
          exercises: [exercise('A'), exercise(), exercise('B'), exercise('B')],
        }),
      ]),
    ).toEqual(['days[0].exercises[0].supersetGroup: alone']);
  });

  it('reports every problem at once', () => {
    expect(
      problems(1, [
        day({ weekNo: 5 }),
        day({ weekNo: 5 }),
        day({ dayNo: 2, isRest: true }),
      ]).sort(),
    ).toEqual(
      [
        'days[0].weekNo: beyond the plan',
        'days[1].weekNo: beyond the plan',
        'days[1]: duplicate',
        'days[2]: a rest day has no exercises',
      ].sort(),
    );
  });
});
