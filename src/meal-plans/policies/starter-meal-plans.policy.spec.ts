import { StarterMealPlansPolicy } from './starter-meal-plans.policy';

const templates = new StarterMealPlansPolicy().starterTemplates();

describe('StarterMealPlansPolicy', () => {
  it('gives a coach a cutting and a bulking template', () => {
    expect(templates).toHaveLength(2);
    expect(templates[0].kcalTarget).toBeLessThan(templates[1].kcalTarget);
  });

  it('names each in Arabic and sets all four targets', () => {
    for (const template of templates) {
      expect(template.name).toMatch(/[؀-ۿ]/);
      for (const target of [
        template.kcalTarget,
        template.proteinTargetG,
        template.carbTargetG,
        template.fatTargetG,
      ]) {
        expect(target).toBeGreaterThan(0);
      }
    }
  });

  it('has four or more meals a day, each at a time and with at least two foods', () => {
    for (const template of templates) {
      expect(template.meals.length).toBeGreaterThanOrEqual(4);
      for (const meal of template.meals) {
        expect(meal.name.length).toBeGreaterThan(0);
        expect(meal.timeHint).toMatch(/^\d{2}:\d{2}$/);
        expect(meal.items.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('names foods by their library handle, in amounts above zero', () => {
    for (const template of templates) {
      for (const item of template.meals.flatMap((meal) => meal.items)) {
        expect(item.slug).toMatch(/^[a-z0-9-]+$/);
        expect(item.quantity).toBeGreaterThan(0);
      }
    }
  });
});
