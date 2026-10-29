import { MealPlanTotalsPolicy } from './meal-plan-totals.policy';

const policy = new MealPlanTotalsPolicy();

const noTargets = {
  kcalTarget: null,
  proteinTargetG: null,
  carbTargetG: null,
  fatTargetG: null,
};
const item = (kcal: number, proteinG: number, carbG: number, fatG: number) => ({
  kcal,
  proteinG,
  carbG,
  fatG,
});
const meal = (dayNo: number, ...items: ReturnType<typeof item>[]) => ({
  dayNo,
  items,
});

describe('MealPlanTotalsPolicy', () => {
  describe('meal totals', () => {
    it('adds the items of a meal', () => {
      expect(
        policy.mealTotals([item(100, 10, 5, 2), item(50.5, 1.25, 10, 0.5)]),
      ).toEqual({ kcal: 150.5, proteinG: 11.25, carbG: 15, fatG: 2.5 });
    });

    it('is nothing for an empty meal', () => {
      expect(policy.mealTotals([])).toEqual({
        kcal: 0,
        proteinG: 0,
        carbG: 0,
        fatG: 0,
      });
    });
  });

  describe('days', () => {
    it('is one total, for every day, when no meal is pinned to a weekday', () => {
      const days = policy.days(noTargets, [
        meal(0, item(400, 30, 40, 10)),
        meal(0, item(600, 40, 60, 20)),
      ]);

      expect(days).toHaveLength(1);
      expect(days[0]).toMatchObject({
        dayNo: 0,
        kcal: 1000,
        proteinG: 70,
        carbG: 100,
        fatG: 30,
      });
    });

    it('is seven totals once any meal is pinned: the everyday meals plus that day’s own', () => {
      const days = policy.days(noTargets, [
        meal(0, item(400, 30, 40, 10)),
        meal(2, item(300, 20, 30, 5)),
        meal(5, item(100, 5, 10, 1)),
      ]);

      expect(days.map((d) => d.dayNo)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(days.map((d) => d.kcal)).toEqual([
        400, 700, 400, 400, 500, 400, 400,
      ]);
    });

    it('counts a day with only pinned meals and no everyday ones', () => {
      const days = policy.days(noTargets, [meal(3, item(250, 10, 30, 8))]);

      expect(days.find((d) => d.dayNo === 3)?.kcal).toBe(250);
      expect(days.find((d) => d.dayNo === 4)?.kcal).toBe(0);
    });

    it('is zero for a plan with no meals yet', () => {
      expect(policy.days(noTargets, [])).toEqual([
        expect.objectContaining({ dayNo: 0, kcal: 0, proteinG: 0 }),
      ]);
    });
  });

  describe('the gap to the targets', () => {
    const targets = {
      kcalTarget: 2000,
      proteinTargetG: 150,
      carbTargetG: 200,
      fatTargetG: 60,
    };

    it('is the target minus the total, positive when short', () => {
      const [day] = policy.days(targets, [meal(0, item(1800, 132, 210, 55))]);

      expect(day.gap).toEqual({
        kcal: 200,
        proteinG: 18,
        carbG: -10,
        fatG: 5,
      });
    });

    it('is null for a macro with no target', () => {
      const [day] = policy.days({ ...noTargets, proteinTargetG: 150 }, [
        meal(0, item(1000, 100, 100, 30)),
      ]);

      expect(day.gap).toEqual({
        kcal: null,
        proteinG: 50,
        carbG: null,
        fatG: null,
      });
    });
  });

  describe('the macro split', () => {
    it('is the share of the day’s calories each macro brings', () => {
      // 100 g protein = 400, 100 g carb = 400, 25 g fat = 225: 1025 in all
      const [day] = policy.days(noTargets, [meal(0, item(1025, 100, 100, 25))]);

      expect(day.split).toEqual({ proteinPct: 39, carbPct: 39, fatPct: 22 });
    });

    it('is nothing when there is nothing', () => {
      const [day] = policy.days(noTargets, []);

      expect(day.split).toEqual({ proteinPct: 0, carbPct: 0, fatPct: 0 });
    });

    it('always adds up to a hundred', () => {
      const [day] = policy.days(noTargets, [meal(0, item(500, 33, 33, 33))]);

      expect(day.split.proteinPct + day.split.carbPct + day.split.fatPct).toBe(
        100,
      );
    });
  });
});
