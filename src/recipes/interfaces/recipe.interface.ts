import type {
  FoodMacros,
  FoodRecord,
} from '../../foods/interfaces/food.interface';
import type { MealCategory } from '../../foods/enums/meal-category.enum';
import type { NutritionAliasKind } from '../../foods/enums/nutrition-alias-kind.enum';
import type { RecipeOrigin } from '../../foods/enums/recipe-origin.enum';
import type { NutritionConfidence } from '../../foods/enums/nutrition-confidence.enum';
export interface RecipeIngredientInput {
  foodId: string;
  weightG: number;
  noteAr?: string | null;
}
export interface RecipePortionInput {
  nameAr: string;
  weightG: number;
  isDefault: boolean;
}
export interface RecipeAliasInput {
  kind: NutritionAliasKind;
  alias: string;
}
export interface NewRecipe {
  nameAr: string;
  nameEn?: string | null;
  descriptionAr?: string | null;
  finishedWeightG: number;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  youtubeVideoId?: string | null;
  mealTags?: MealCategory[];
  ingredients: RecipeIngredientInput[];
  steps: { instruction: string }[];
  portions: RecipePortionInput[];
  aliases?: RecipeAliasInput[];
}
export interface RecipeChanges extends Partial<NewRecipe> {
  isActive?: boolean;
}
export interface RecipePortion extends RecipePortionInput {
  id: string;
  sortOrder: number;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}
export interface RecipeRecord extends FoodMacros {
  id: string;
  slug: string | null;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  finishedWeightG: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  youtubeVideoId: string | null;
  mealTags: MealCategory[];
  isOwn: boolean;
  isActive: boolean;
  origin: RecipeOrigin;
  originNote: string | null;
  confidence: NutritionConfidence | null;
  reviewFlags: string[];
  copiedFromRecipeId: string | null;
  ingredients: (RecipeIngredientInput & {
    sortOrder: number;
    food?: Pick<FoodRecord, 'id' | 'nameAr' | 'nameEn' | 'category'>;
  })[];
  steps: { instruction: string; sortOrder: number }[];
  portions: RecipePortion[];
  aliases: RecipeAliasInput[];
  ingredientCount: number;
  defaultPortion: RecipePortion | null;
}
export type RecipeSummary = Omit<
  RecipeRecord,
  'ingredients' | 'steps' | 'portions' | 'aliases' | 'defaultPortion'
> & { defaultPortion: RecipeStoredPortion | null };

export type RecipeStoredPortion = Omit<
  RecipePortion,
  'caloriesKcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG'
>;
export type RecipeStoredRecord = Omit<
  RecipeRecord,
  'portions' | 'defaultPortion'
> & {
  portions: RecipeStoredPortion[];
  defaultPortion: RecipeStoredPortion | null;
};
