import { MealPlanTotalsPolicy } from './meal-plan-totals.policy';

const policy = new MealPlanTotalsPolicy();

const noTargets = {
  caloriesKcalTarget: null,
  proteinGTarget: null,
  carbsGTarget: null,
  fatGTarget: null,
};
const item = (
  caloriesKcal: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
) => ({
  caloriesKcal,
  proteinG,
  carbsG,
  fatG,
});
const meal = (weekday: number | null, ...items: ReturnType<typeof item>[]) => ({
  weekday,
  items,
});

describe('MealPlanTotalsPolicy', () => {
  describe('meal totals', () => {
    it('adds the items of a meal', () => {
      expect(
        policy.mealTotals([item(100, 10, 5, 2), item(50.5, 1.25, 10, 0.5)]),
      ).toEqual({
        caloriesKcal: 150.5,
        proteinG: 11.25,
        carbsG: 15,
        fatG: 2.5,
      });
    });

    it('is nothing for an empty meal', () => {
      expect(policy.mealTotals([])).toEqual({
        caloriesKcal: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      });
    });
  });

  describe('days', () => {
    it('is one total, for every day, when no meal is pinned to a weekday', () => {
      const days = policy.days(noTargets, [
        meal(null, item(400, 30, 40, 10)),
        meal(null, item(600, 40, 60, 20)),
      ]);

      expect(days).toHaveLength(1);
      expect(days[0]).toMatchObject({
        weekday: null,
        caloriesKcal: 1000,
        proteinG: 70,
        carbsG: 100,
        fatG: 30,
      });
    });

    it('is seven totals once any meal is pinned: the everyday meals plus that day’s own', () => {
      const days = policy.days(noTargets, [
        meal(null, item(400, 30, 40, 10)),
        meal(2, item(300, 20, 30, 5)),
        meal(5, item(100, 5, 10, 1)),
      ]);

      expect(days.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(days.map((d) => d.caloriesKcal)).toEqual([
        400, 700, 400, 400, 500, 400, 400,
      ]);
    });

    it('counts a day with only pinned meals and no everyday ones', () => {
      const days = policy.days(noTargets, [meal(3, item(250, 10, 30, 8))]);

      expect(days.find((d) => d.weekday === 3)?.caloriesKcal).toBe(250);
      expect(days.find((d) => d.weekday === 4)?.caloriesKcal).toBe(0);
    });

    it('is zero for a plan with no meals yet', () => {
      expect(policy.days(noTargets, [])).toEqual([
        expect.objectContaining({
          weekday: null,
          caloriesKcal: 0,
          proteinG: 0,
        }),
      ]);
    });
  });

  describe('the gap to the targets', () => {
    const targets = {
      caloriesKcalTarget: 2000,
      proteinGTarget: 150,
      carbsGTarget: 200,
      fatGTarget: 60,
    };

    it('is the target minus the total, positive when short', () => {
      const [day] = policy.days(targets, [
        meal(null, item(1800, 132, 210, 55)),
      ]);

      expect(day.gap).toEqual({
        caloriesKcal: 200,
        proteinG: 18,
        carbsG: -10,
        fatG: 5,
      });
    });

    it('is null for a macro with no target', () => {
      const [day] = policy.days({ ...noTargets, proteinGTarget: 150 }, [
        meal(null, item(1000, 100, 100, 30)),
      ]);

      expect(day.gap).toEqual({
        caloriesKcal: null,
        proteinG: 50,
        carbsG: null,
        fatG: null,
      });
    });
  });

  describe('the macro split', () => {
    it('is the share of the day’s calories each macro brings', () => {
      // 100 g protein = 400, 100 g carb = 400, 25 g fat = 225: 1025 in all
      const [day] = policy.days(noTargets, [
        meal(null, item(1025, 100, 100, 25)),
      ]);

      expect(day.split).toEqual({ proteinPct: 39, carbPct: 39, fatPct: 22 });
    });

    it('is nothing when there is nothing', () => {
      const [day] = policy.days(noTargets, []);

      expect(day.split).toEqual({ proteinPct: 0, carbPct: 0, fatPct: 0 });
    });

    it('always adds up to a hundred', () => {
      const [day] = policy.days(noTargets, [meal(null, item(500, 33, 33, 33))]);

      expect(day.split.proteinPct + day.split.carbPct + day.split.fatPct).toBe(
        100,
      );
    });
  });
});
