import type { MealPlanStatus } from '../enums/meal-plan-status.enum';

/** What a meal item or substitute is worth, resolved from the food when the plan is saved. */
export interface ResolvedMacros {
  grams: number;
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

export interface MealSubstituteInput {
  foodId: string;
  /** In units when `unitId` is given, in grams when it is not. */
  quantity: number;
  unitId?: string;
}

export interface MealItemInput extends MealSubstituteInput {
  /** Alternatives the client can swap in when they cannot find the food. */
  substitutes?: MealSubstituteInput[];
}

export interface MealInput {
  /** 0 repeats every day; 1 to 7 pins the meal to a weekday. */
  dayNo: number;
  name: string;
  /** `HH:MM`, roughly when it is eaten. */
  timeHint?: string;
  notes?: string;
  /** Their order is their position in the meal. */
  items: MealItemInput[];
}

export interface MealSubstituteRecord extends ResolvedMacros {
  position: number;
  foodId: string;
  /** Copied from the food when the plan was saved. */
  foodName: string;
  quantity: number;
  unitId: string | null;
  unitLabelAr: string | null;
}

export interface MealItemRecord extends MealSubstituteRecord {
  substitutes: MealSubstituteRecord[];
}

export interface MacroTotals {
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

export interface MealRecord {
  dayNo: number;
  position: number;
  name: string;
  timeHint: string | null;
  notes: string | null;
  totals: MacroTotals;
  items: MealItemRecord[];
}

/** A meal as stored: the totals are worked out when it is read. */
export type StoredMealRecord = Omit<MealRecord, 'totals'>;

export interface MealPlanTargets {
  kcalTarget: number | null;
  proteinTargetG: number | null;
  carbTargetG: number | null;
  fatTargetG: number | null;
}

/** What one day of the plan adds up to, and how far it is from the targets. */
export interface DayTotals extends MacroTotals {
  /** 0 when the plan is the same every day, otherwise 1 to 7. */
  dayNo: number;
  /** The share of the day's calories each macro brings, in percent. */
  split: { proteinPct: number; carbPct: number; fatPct: number };
  /** Target minus total: positive means short of it. Null when there is no target. */
  gap: {
    kcal: number | null;
    proteinG: number | null;
    carbG: number | null;
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
  kcalTarget?: number | null;
  proteinTargetG?: number | null;
  carbTargetG?: number | null;
  fatTargetG?: number | null;
  notes?: string | null;
}

export interface MealPlanListFilter {
  clientId?: string;
  isTemplate?: boolean;
  status?: MealPlanStatus;
}

/** A meal with its items resolved: the structure to be stored. */
export interface StoredMeal {
  dayNo: number;
  name: string;
  timeHint: string | null;
  notes: string | null;
  items: StoredMealItem[];
}

export interface StoredMealSubstitute extends ResolvedMacros {
  foodId: string;
  foodName: string;
  quantity: number;
  unitId: string | null;
}

export interface StoredMealItem extends StoredMealSubstitute {
  substitutes: StoredMealSubstitute[];
}
