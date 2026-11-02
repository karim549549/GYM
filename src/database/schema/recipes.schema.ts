import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { foods } from './foods.schema';
import { workspaces } from './workspaces.schema';
import { RecipeOrigin } from '../../foods/enums/recipe-origin.enum';
import { NutritionConfidence } from '../../foods/enums/nutrition-confidence.enum';
import { NutritionAliasKind } from '../../foods/enums/nutrition-alias-kind.enum';
import { MealCategory } from '../../foods/enums/meal-category.enum';

export const recipes = pgTable(
  'recipes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, {
      onDelete: 'cascade',
    }),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en'),
    slug: text('slug'),
    searchName: text('search_name').notNull().default(''),
    descriptionAr: text('description_ar'),
    finishedWeightG: numeric('finished_weight_g', { mode: 'number' }).notNull(),
    prepMinutes: integer('prep_minutes'),
    cookMinutes: integer('cook_minutes'),
    youtubeVideoId: text('youtube_video_id'),
    copiedFromRecipeId: uuid('copied_from_recipe_id').references(
      (): AnyPgColumn => recipes.id,
    ),
    caloriesKcalPer100g: numeric('calories_kcal_per_100g', {
      precision: 7,
      scale: 2,
      mode: 'number',
    }).notNull(),
    proteinGPer100g: numeric('protein_g_per_100g', {
      precision: 7,
      scale: 2,
      mode: 'number',
    }).notNull(),
    carbsGPer100g: numeric('carbs_g_per_100g', {
      precision: 7,
      scale: 2,
      mode: 'number',
    }).notNull(),
    fatGPer100g: numeric('fat_g_per_100g', {
      precision: 7,
      scale: 2,
      mode: 'number',
    }).notNull(),
    fiberGPer100g: numeric('fiber_g_per_100g', {
      precision: 7,
      scale: 2,
      mode: 'number',
    }).notNull(),
    mealTags: text('meal_tags')
      .array()
      .$type<MealCategory[]>()
      .notNull()
      .default(sql`'{}'`),
    origin: text('origin').$type<RecipeOrigin>().notNull(),
    originNote: text('origin_note'),
    confidence: text('confidence').$type<NutritionConfidence>(),
    reviewFlags: text('review_flags')
      .array()
      .notNull()
      .default(sql`'{}'`),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check('recipes_slug_check', sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    uniqueIndex('recipes_global_slug_idx')
      .on(t.slug)
      .where(sql`${t.workspaceId} is null`),
    unique('recipes_id_workspace_key').on(t.id, t.workspaceId),
    check('recipes_finished_weight_check', sql`${t.finishedWeightG} > 0`),
    check(
      'recipes_minutes_check',
      sql`${t.prepMinutes} >= 0 and ${t.cookMinutes} >= 0`,
    ),
    check(
      'recipes_youtube_video_id_check',
      sql`${t.youtubeVideoId} ~ '^[A-Za-z0-9_-]{11}$'`,
    ),
    check(
      'recipes_macros_check',
      sql`${t.caloriesKcalPer100g} >= 0 and ${t.proteinGPer100g} >= 0 and ${t.carbsGPer100g} >= 0 and ${t.fatGPer100g} >= 0 and ${t.fiberGPer100g} >= 0`,
    ),
    check(
      'recipes_meal_tags_check',
      sql`${t.mealTags} <@ ARRAY[${sql.raw(
        Object.values(MealCategory)
          .map((v) => `'${v}'`)
          .join(', '),
      )}]::text[]`,
    ),
    check(
      'recipes_origin_check',
      sql`${t.origin} in (${sql.raw(
        Object.values(RecipeOrigin)
          .map((v) => `'${v}'`)
          .join(', '),
      )})`,
    ),
    check(
      'recipes_confidence_check',
      sql`${t.confidence} in (${sql.raw(
        Object.values(NutritionConfidence)
          .map((v) => `'${v}'`)
          .join(', '),
      )})`,
    ),
    index('recipes_search_name_trgm_idx').using(
      'gin',
      t.searchName.op('gin_trgm_ops'),
    ),
  ],
);
export const recipeIngredients = pgTable(
  'recipe_ingredients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id'),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull(),
    foodId: uuid('food_id')
      .notNull()
      .references(() => foods.id),
    weightG: numeric('weight_g', { mode: 'number' }).notNull(),
    noteAr: text('note_ar'),
  },
  (t) => [
    foreignKey({
      name: 'recipe_ingredients_recipe_workspace_fk',
      columns: [t.recipeId, t.workspaceId],
      foreignColumns: [recipes.id, recipes.workspaceId],
    }).onDelete('cascade'),
    unique('recipe_ingredients_recipe_sort_order_key').on(
      t.recipeId,
      t.sortOrder,
    ),
    check('recipe_ingredients_weight_g_check', sql`${t.weightG} > 0`),
  ],
);
export const recipeSteps = pgTable(
  'recipe_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id'),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull(),
    instruction: text('instruction').notNull(),
  },
  (t) => [
    foreignKey({
      name: 'recipe_steps_recipe_workspace_fk',
      columns: [t.recipeId, t.workspaceId],
      foreignColumns: [recipes.id, recipes.workspaceId],
    }).onDelete('cascade'),
    unique('recipe_steps_recipe_sort_order_key').on(t.recipeId, t.sortOrder),
  ],
);
export const recipePortions = pgTable(
  'recipe_portions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id'),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    nameAr: text('name_ar').notNull(),
    weightG: numeric('weight_g', { mode: 'number' }).notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    foreignKey({
      name: 'recipe_portions_recipe_workspace_fk',
      columns: [t.recipeId, t.workspaceId],
      foreignColumns: [recipes.id, recipes.workspaceId],
    }).onDelete('cascade'),
    unique('recipe_portions_id_recipe_key').on(t.id, t.recipeId),
    check('recipe_portions_weight_g_check', sql`${t.weightG} > 0`),
    uniqueIndex('recipe_portions_one_default_idx')
      .on(t.recipeId)
      .where(sql`${t.isDefault}`),
  ],
);
export const recipeAliases = pgTable(
  'recipe_aliases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id'),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<NutritionAliasKind>().notNull(),
    alias: text('alias').notNull(),
    searchAlias: text('search_alias').notNull().default(''),
  },
  (t) => [
    foreignKey({
      name: 'recipe_aliases_recipe_workspace_fk',
      columns: [t.recipeId, t.workspaceId],
      foreignColumns: [recipes.id, recipes.workspaceId],
    }).onDelete('cascade'),
    unique('recipe_aliases_recipe_kind_search_key').on(
      t.recipeId,
      t.kind,
      t.searchAlias,
    ),
    check(
      'recipe_aliases_kind_check',
      sql`${t.kind} in (${sql.raw(
        Object.values(NutritionAliasKind)
          .map((v) => `'${v}'`)
          .join(', '),
      )})`,
    ),
    index('recipe_aliases_search_alias_trgm_idx').using(
      'gin',
      t.searchAlias.op('gin_trgm_ops'),
    ),
  ],
);
