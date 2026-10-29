import { StarterPlansPolicy } from './starter-plans.policy';

const templates = new StarterPlansPolicy().starterTemplates();

describe('StarterPlansPolicy', () => {
  it('gives a coach a full body, a push pull legs and an upper lower template', () => {
    expect(templates.map((t) => t.days.length)).toEqual([3, 6, 4]);
  });

  it('names each in Arabic and gives it a goal', () => {
    for (const template of templates) {
      expect(template.name).toMatch(/[؀-ۿ]/);
      expect(template.goal.length).toBeGreaterThan(0);
    }
  });

  it('numbers the days within a week and never repeats one', () => {
    for (const template of templates) {
      const numbers = template.days.map((day) => day.dayNo);
      expect(new Set(numbers).size).toBe(numbers.length);
      expect(numbers.every((n) => n >= 1 && n <= 7)).toBe(true);
    }
  });

  it('puts at least four different exercises on every day', () => {
    for (const template of templates) {
      for (const day of template.days) {
        expect(day.exerciseSlugs.length).toBeGreaterThanOrEqual(4);
        expect(new Set(day.exerciseSlugs).size).toBe(day.exerciseSlugs.length);
      }
    }
  });

  it('has a set scheme a beginner can follow', () => {
    const scheme = new StarterPlansPolicy().setScheme();

    expect(scheme).toEqual({ sets: 3, reps: '8-12', restSeconds: 90 });
  });

  it('names the exercises by their library handle', () => {
    const slugs = templates.flatMap((t) =>
      t.days.flatMap((d) => d.exerciseSlugs),
    );

    expect(slugs.every((slug) => /^[a-z0-9-]+$/.test(slug))).toBe(true);
  });
});
