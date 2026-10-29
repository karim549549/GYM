import { Injectable } from '@nestjs/common';
import type {
  DayTotals,
  MacroTotals,
  MealPlanTargets,
} from '../interfaces/meal-plan.interface';

/**
 * What a plan adds up to and how far it is from its targets, worked out from the numbers saved on
 * each item (never joined back to the foods). A plan whose meals all repeat every day has one daily
 * total; as soon as any meal is pinned to a weekday it has seven, each the everyday meals plus that
 * day's own, so a seven-day plan never reports one impossible sum.
 */
@Injectable()
export class MealPlanTotalsPolicy {
  private static readonly KCAL_PER_GRAM = { protein: 4, carb: 4, fat: 9 };
  private static readonly EVERY_DAY = 0;
  private static readonly WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

  mealTotals(items: MacroTotals[]): MacroTotals {
    return this.sum(items);
  }

  days(
    targets: MealPlanTargets,
    meals: { dayNo: number; items: MacroTotals[] }[],
  ): DayTotals[] {
    const everyDay = MealPlanTotalsPolicy.EVERY_DAY;
    const pinned = meals.some((meal) => meal.dayNo !== everyDay);
    const dayNos = pinned ? MealPlanTotalsPolicy.WEEKDAYS : [everyDay];

    return dayNos.map((dayNo) => {
      const items = meals
        .filter((meal) => meal.dayNo === everyDay || meal.dayNo === dayNo)
        .flatMap((meal) => meal.items);
      const totals = this.sum(items);
      return {
        dayNo,
        ...totals,
        split: this.split(totals),
        gap: {
          kcal: this.gap(targets.kcalTarget, totals.kcal),
          proteinG: this.gap(targets.proteinTargetG, totals.proteinG),
          carbG: this.gap(targets.carbTargetG, totals.carbG),
          fatG: this.gap(targets.fatTargetG, totals.fatG),
        },
      };
    });
  }

  private sum(items: MacroTotals[]): MacroTotals {
    return {
      kcal: this.round(items.reduce((sum, i) => sum + i.kcal, 0)),
      proteinG: this.round(items.reduce((sum, i) => sum + i.proteinG, 0)),
      carbG: this.round(items.reduce((sum, i) => sum + i.carbG, 0)),
      fatG: this.round(items.reduce((sum, i) => sum + i.fatG, 0)),
    };
  }

  private gap(target: number | null, total: number): number | null {
    return target === null ? null : this.round(target - total);
  }

  /** Percent of the calories each macro brings, whole numbers that add up to 100. */
  private split(totals: MacroTotals): DayTotals['split'] {
    const { protein, carb, fat } = MealPlanTotalsPolicy.KCAL_PER_GRAM;
    const parts = [
      protein * totals.proteinG,
      carb * totals.carbG,
      fat * totals.fatG,
    ];
    const whole = parts.reduce((sum, part) => sum + part, 0);
    if (whole === 0) {
      return { proteinPct: 0, carbPct: 0, fatPct: 0 };
    }
    const [proteinPct, carbPct] = parts
      .slice(0, 2)
      .map((part) => Math.round((part / whole) * 100));
    // the last takes what is left, so rounding can never make the three add up to 99 or 101
    return { proteinPct, carbPct, fatPct: 100 - proteinPct - carbPct };
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
