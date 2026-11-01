import type { FoodState } from '../enums/food-state.enum';
import type { FoodOrigin } from '../enums/food-origin.enum';
import type { FoodEntryBasis } from '../enums/food-entry-basis.enum';
import type { NutritionConfidence } from '../enums/nutrition-confidence.enum';
import type { NutritionAliasKind } from '../enums/nutrition-alias-kind.enum';
import type { NutrientMeasureUnit } from '../enums/nutrient-measure-unit.enum';
import type { FoodCategory } from '../enums/food-category.enum';

export interface FoodPortionRecord {
  id: string;
  /** For example "cup", "loaf", "tablespoon", in Arabic. */
  nameAr: string;
  /** What one of them weighs. */
  weightG: number;
  isDefault: boolean;
}

/** Macros are per 100 g, always. */
export interface FoodMacros {
  caloriesKcalPer100g: number;
  proteinGPer100g: number;
  carbsGPer100g: number;
  fatGPer100g: number;
  fiberGPer100g: number;
}

export interface FoodRecord extends FoodMacros {
  brand: string | null;
  barcode: string | null;
  state: FoodState | null;
  description: string | null;
  origin: FoodOrigin;
  usdaFdcId: number | null;
  confidence: NutritionConfidence | null;
  reviewFlags: string[];
  isVerified: boolean;
  isOwn: boolean;
  entryBasis: FoodEntryBasis;
  enteredServingWeightG: number | null;
  aliases: Record<NutritionAliasKind, string[]>;
  nutrients: FoodNutrientRecord[];
  defaultPortion: FoodPortionRecord | null;
  id: string;
  nameAr: string;
  nameEn: string | null;
  /** Only the library's own foods have one. */
  slug: string | null;
  category: FoodCategory;
  isActive: boolean;
  /** True for a coach's own addition, false for the library's. */
  isCustom: boolean;
  /** Where the numbers came from, so a disputed one can be re-checked. */
  originNote: string | null;
  portions: FoodPortionRecord[];
}

export interface FoodPortionInput {
  nameAr: string;
  weightG: number;
  isDefault?: boolean;
}

export interface NewFood extends FoodMacros, FoodLabelInput {
  nameAr: string;
  nameEn?: string;
  category: FoodCategory;
  portions?: FoodPortionInput[];
}

/** What a coach may change on their own food. `null` clears the English name. */
export interface FoodChanges extends Partial<FoodMacros>, FoodLabelInput {
  nameAr?: string;
  nameEn?: string | null;
  category?: FoodCategory;
  isActive?: boolean;
  portions?: FoodPortionInput[];
}

export interface FoodListFilter {
  state?: FoodState;
  scope?: 'all' | 'shared' | 'mine';
  /** Part of either name; the characters of a pattern are plain text. */
  search?: string;
  category?: FoodCategory;
  includeInactive?: boolean;
}

export interface FoodEntryInput {
  basis: FoodEntryBasis;
  servingWeightG?: number;
}
export interface FoodNutrientInput {
  code: string;
  amount: number;
}
export interface FoodAliasInput {
  kind: NutritionAliasKind;
  alias: string;
}
export interface FoodNutrientRecord {
  code: string;
  nameAr: string;
  nameEn: string;
  measureUnit: NutrientMeasureUnit;
  amountPer100g: number;
}
export interface FoodLabelInput {
  brand?: string | null;
  barcode?: string | null;
  state?: FoodState | null;
  description?: string | null;
  origin?: FoodOrigin.PACKAGE_LABEL | FoodOrigin.ESTIMATE;
  entry?: FoodEntryInput;
  nutrients?: FoodNutrientInput[];
  aliases?: FoodAliasInput[];
  confirmNotDuplicate?: boolean;
}
