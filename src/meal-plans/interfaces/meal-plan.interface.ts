import type { MealPlanStatus } from '../enums/meal-plan-status.enum';

/** What a meal item or substitute is worth, resolved from the food when the plan is saved. */
export interface ResolvedMacros {
  weightG: number;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealSubstituteInput {
  foodId?: string;
  recipeId?: string;
  /** In portions when `portionId` is given, in grams when it is not. */
  quantity: number;
  portionId?: string;
}

export interface MealItemInput extends MealSubstituteInput {
  /** Alternatives the client can swap in when they cannot find the food. */
  substitutes?: MealSubstituteInput[];
}

export interface MealInput {
  /** Null repeats every day; 1 to 7 pins the meal to a weekday. */
  weekday: number | null;
  name: string;
  /** `HH:MM`, roughly when it is eaten. */
  suggestedTime?: string;
  notes?: string;
  /** Their order is their order in the meal. */
  items: MealItemInput[];
}

export interface MealSubstituteRecord extends ResolvedMacros {
  kind: 'food' | 'recipe';
  sortOrder: number;
  foodId: string | null;
  recipeId: string | null;
  /** Copied from the food when the plan was saved. */
  itemName: string;
  quantity: number;
  portionId: string | null;
  portionNameAr: string | null;
}

export interface MealItemRecord extends MealSubstituteRecord {
  substitutes: MealSubstituteRecord[];
}

export interface MacroTotals {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealRecord {
  weekday: number | null;
  sortOrder: number;
  name: string;
  suggestedTime: string | null;
  notes: string | null;
  totals: MacroTotals;
  items: MealItemRecord[];
}

/** A meal as stored: the totals are worked out when it is read. */
export type StoredMealRecord = Omit<MealRecord, 'totals'>;

export interface MealPlanTargets {
  caloriesKcalTarget: number | null;
  proteinGTarget: number | null;
  carbsGTarget: number | null;
  fatGTarget: number | null;
}

/** What one day of the plan adds up to, and how far it is from the targets. */
export interface DayTotals extends MacroTotals {
  /** Null when the plan is the same every day, otherwise 1 to 7. */
  weekday: number | null;
  /** The share of the day's calories each macro brings, in percent. */
  split: { proteinPct: number; carbPct: number; fatPct: number };
  /** Target minus total: positive means short of it. Null when there is no target. */
  gap: {
    caloriesKcal: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
  };
}

/** A plan without its meals, as listed. */
export interface MealPlanSummary extends MealPlanTargets {
  id: string;
  /** Null for a template. */
  clientId: string | null;
  isTemplate: boolean;
  name: string;
  status: MealPlanStatus;
  startsOn: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface MealPlanRecord extends MealPlanSummary {
  meals: MealRecord[];
  days: DayTotals[];
}

export interface NewMealPlan extends Partial<MealPlanTargets> {
  name: string;
  notes?: string;
  /** A client's plan, or a template when left out. */
  clientId?: string;
  /** Start from a copy of this plan or template. */
  fromPlanId?: string;
}

export interface MealPlanChanges {
  name?: string;
  caloriesKcalTarget?: number | null;
  proteinGTarget?: number | null;
  carbsGTarget?: number | null;
  fatGTarget?: number | null;
  notes?: string | null;
}

export interface MealPlanListFilter {
  clientId?: string;
  isTemplate?: boolean;
  status?: MealPlanStatus;
}

/** A meal with its items resolved: the structure to be stored. */
export interface StoredMeal {
  weekday: number | null;
  name: string;
  suggestedTime: string | null;
  notes: string | null;
  items: StoredMealItem[];
}

export interface StoredMealSubstitute extends ResolvedMacros {
  foodId: string | null;
  recipeId?: string | null;
  itemName: string;
  quantity: number;
  portionId: string | null;
}

export interface StoredMealItem extends StoredMealSubstitute {
  substitutes: StoredMealSubstitute[];
}
