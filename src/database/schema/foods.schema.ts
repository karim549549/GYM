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
import { workspaces } from './workspaces.schema';

const CATEGORY_VALUES = Object.values(FoodCategory)
  .map((category) => `'${category}'`)
  .join(', ');

const grams = (name: string, precision = 6) =>
  numeric(name, { precision, scale: 2, mode: 'number' });

/**
 * The food database, the library's own and a coach's additions in one table (no workspace means
 * everyone sees it). Macros are always per 100 g, with no exceptions: one basis plus a table of
 * units means the arithmetic is always grams / 100 * macro, everywhere. Never deleted, only
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
    category: text('category').$type<FoodCategory>().notNull(),
    kcal100g: grams('kcal_100g', 7).notNull(),
    protein100g: grams('protein_100g').notNull(),
    carb100g: grams('carb_100g').notNull(),
    fat100g: grams('fat_100g').notNull(),
    fiber100g: grams('fiber_100g').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    /** Where the numbers came from, so a disputed one can be re-checked. */
    source: text('source'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // lets the unit rows prove they are in the food's own workspace
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
      sql`${table.kcal100g} >= 0 and ${table.protein100g} >= 0 and ${table.carb100g} >= 0 and ${table.fat100g} >= 0 and ${table.fiber100g} >= 0`,
    ),
  ],
);

/**
 * The ways a person actually measures a food (a loaf, a cup, a tablespoon), each worth so many
 * grams. No Egyptian client weighs their food, so this table is what makes the product usable.
 */
export const foodUnits = pgTable(
  'food_units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id'),
    foodId: uuid('food_id').notNull(),
    labelAr: text('label_ar').notNull(),
    grams: grams('grams', 7).notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    position: integer('position').notNull().default(0),
  },
  (table) => [
    foreignKey({
      name: 'food_units_food_workspace_fk',
      columns: [table.foodId, table.workspaceId],
      foreignColumns: [foods.id, foods.workspaceId],
    }).onDelete('cascade'),
    uniqueIndex('food_units_one_default_idx')
      .on(table.foodId)
      .where(sql`${table.isDefault}`),
    index('food_units_food_idx').on(table.foodId),
    check('food_units_grams_check', sql`${table.grams} > 0`),
  ],
);
