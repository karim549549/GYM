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
} from 'drizzle-orm/pg-core';
import { FoodCategory } from '../../foods/enums/food-category.enum';
import { FoodState } from '../../foods/enums/food-state.enum';
import { FoodOrigin } from '../../foods/enums/food-origin.enum';
import { NutritionConfidence } from '../../foods/enums/nutrition-confidence.enum';
import { FoodEntryBasis } from '../../foods/enums/food-entry-basis.enum';
import { workspaces } from './workspaces.schema';

const CATEGORY_VALUES = Object.values(FoodCategory)
  .map((category) => `'${category}'`)
  .join(', ');

const macro = (name: string, precision = 6) =>
  numeric(name, { precision, scale: 2, mode: 'number' });

/**
 * The food database, the library's own and a coach's additions in one table (no workspace means
 * everyone sees it). Macros are always per 100 g, with no exceptions: one basis plus a table of
 * portions means the arithmetic is always grams / 100 * macro, everywhere. Never deleted, only
 * deactivated, because plans point at foods.
 */
export const foods = pgTable(
  'foods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, {
      onDelete: 'cascade',
    }),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en'),
    /** A stable handle for the library's own foods, so seeded plans can name them. */
    slug: text('slug'),
    brand: text('brand'),
    barcode: text('barcode'),
    searchName: text('search_name').notNull().default(''),
    descriptionAr: text('description_ar'),
    state: text('state').$type<FoodState>(),
    origin: text('origin')
      .$type<FoodOrigin>()
      .notNull()
      .default(FoodOrigin.ESTIMATE),
    confidence: text('confidence').$type<NutritionConfidence>(),
    reviewFlags: text('review_flags')
      .array()
      .notNull()
      .default(sql`'{}'`),
    usdaFdcId: integer('usda_fdc_id'),
    entryBasis: text('entry_basis')
      .$type<FoodEntryBasis>()
      .notNull()
      .default(FoodEntryBasis.PER_100G),
    enteredServingWeightG: numeric('entered_serving_weight_g', {
      mode: 'number',
    }),
    isVerified: boolean('is_verified').notNull().default(false),
    category: text('category').$type<FoodCategory>().notNull(),
    caloriesKcalPer100g: macro('calories_kcal_per_100g', 7).notNull(),
    proteinGPer100g: macro('protein_g_per_100g').notNull(),
    carbsGPer100g: macro('carbs_g_per_100g').notNull(),
    fatGPer100g: macro('fat_g_per_100g').notNull(),
    fiberGPer100g: macro('fiber_g_per_100g').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    /** Where the numbers came from, so a disputed one can be re-checked. */
    originNote: text('origin_note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('foods_shared_barcode_idx')
      .on(table.barcode)
      .where(sql`${table.workspaceId} is null`),
    index('foods_search_name_trgm_idx').using(
      'gin',
      table.searchName.op('gin_trgm_ops'),
    ),
    check('foods_barcode_check', sql`${table.barcode} ~ '^[0-9]{8,14}$'`),
    check(
      'foods_entry_serving_check',
      sql`(${table.entryBasis} <> 'per_serving' or ${table.enteredServingWeightG} is not null) and (${table.enteredServingWeightG} is null or ${table.enteredServingWeightG} > 0)`,
    ),
    check(
      'foods_verified_shared_check',
      sql`not ${table.isVerified} or ${table.workspaceId} is null`,
    ),
    check(
      'foods_state_check',
      sql`${table.state} in (${sql.raw(
        Object.values(FoodState)
          .map((value) => `'${value}'`)
          .join(', '),
      )})`,
    ),
    check(
      'foods_origin_check',
      sql`${table.origin} in (${sql.raw(
        Object.values(FoodOrigin)
          .map((value) => `'${value}'`)
          .join(', '),
      )})`,
    ),
    check(
      'foods_confidence_check',
      sql`${table.confidence} in (${sql.raw(
        Object.values(NutritionConfidence)
          .map((value) => `'${value}'`)
          .join(', '),
      )})`,
    ),
    check(
      'foods_entry_basis_check',
      sql`${table.entryBasis} in (${sql.raw(
        Object.values(FoodEntryBasis)
          .map((value) => `'${value}'`)
          .join(', '),
      )})`,
    ),
    unique('foods_id_workspace_key').on(table.id, table.workspaceId),
    uniqueIndex('foods_global_slug_idx')
      .on(table.slug)
      .where(sql`${table.workspaceId} is null`),
    index('foods_workspace_id_idx').on(table.workspaceId),
    check(
      'foods_category_check',
      sql`${table.category} in (${sql.raw(CATEGORY_VALUES)})`,
    ),
    check(
      'foods_macros_check',
      sql`${table.caloriesKcalPer100g} >= 0 and ${table.proteinGPer100g} >= 0 and ${table.carbsGPer100g} >= 0 and ${table.fatGPer100g} >= 0 and ${table.fiberGPer100g} >= 0`,
    ),
  ],
);

/**
 * The ways a person actually measures a food (a loaf, a cup, a tablespoon), each worth so many
 * grams. No Egyptian client weighs their food, so this table is what makes the product usable.
 */
export const foodPortions = pgTable(
  'food_portions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id'),
    foodId: uuid('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' }),
    nameAr: text('name_ar').notNull(),
    weightG: macro('weight_g', 7).notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    foreignKey({
      name: 'food_portions_food_workspace_fk',
      columns: [table.foodId, table.workspaceId],
      foreignColumns: [foods.id, foods.workspaceId],
    }).onDelete('cascade'),
    unique('food_portions_id_food_key').on(table.id, table.foodId),
    uniqueIndex('food_portions_one_default_idx')
      .on(table.foodId)
      .where(sql`${table.isDefault}`),
    index('food_portions_food_idx').on(table.foodId),
    check('food_portions_weight_g_check', sql`${table.weightG} > 0`),
  ],
);
