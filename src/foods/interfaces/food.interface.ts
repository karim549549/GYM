import type { FoodCategory } from '../enums/food-category.enum';

export interface FoodUnitRecord {
  id: string;
  /** For example "cup", "loaf", "tablespoon", in Arabic. */
  labelAr: string;
  /** What one of them weighs. */
  grams: number;
  isDefault: boolean;
}

/** Macros are per 100 g, always. */
export interface FoodMacros {
  kcal100g: number;
  protein100g: number;
  carb100g: number;
  fat100g: number;
  fiber100g: number;
}

export interface FoodRecord extends FoodMacros {
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
  source: string | null;
  units: FoodUnitRecord[];
}

export interface FoodUnitInput {
  labelAr: string;
  grams: number;
  isDefault?: boolean;
}

export interface NewFood extends FoodMacros {
  nameAr: string;
  nameEn?: string;
  category: FoodCategory;
  units?: FoodUnitInput[];
}

/** What a coach may change on their own food. `null` clears the English name. */
export interface FoodChanges extends Partial<FoodMacros> {
  nameAr?: string;
  nameEn?: string | null;
  category?: FoodCategory;
  isActive?: boolean;
  units?: FoodUnitInput[];
}

export interface FoodListFilter {
  /** Part of either name; the characters of a pattern are plain text. */
  search?: string;
  category?: FoodCategory;
  includeInactive?: boolean;
}
