import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { MealPlanStatus } from '../../meal-plans/enums/meal-plan-status.enum';
import { clients } from './clients.schema';
import { foodPortions, foods } from './foods.schema';
import { recipes, recipePortions } from './recipes.schema';
import { MealCategory } from '../../foods/enums/meal-category.enum';
import { people } from './people.schema';
import { workspaces } from './workspaces.schema';

const STATUS_VALUES = Object.values(MealPlanStatus)
  .map((status) => `'${status}'`)
  .join(', ');

const macro = (name: string, precision = 6) =>
  numeric(name, { precision, scale: 2, mode: 'number' });

/**
 * A client's nutrition plan, or a template, in one table as with workout plans. The targets are
 * what the day's totals are measured against.
 */
export const mealPlans = pgTable(
  'meal_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Null for a template. */
    clientId: uuid('client_id'),
    isTemplate: boolean('is_template').notNull().default(false),
    name: text('name').notNull(),
    caloriesKcalTarget: integer('calories_kcal_target'),
    proteinGTarget: integer('protein_g_target'),
    carbsGTarget: integer('carbs_g_target'),
    fatGTarget: integer('fat_g_target'),
    status: text('status')
      .$type<MealPlanStatus>()
      .notNull()
      .default(MealPlanStatus.DRAFT),
    startsOn: date('starts_on', { mode: 'string' }),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => people.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'meal_plans_client_workspace_fk',
      columns: [table.clientId, table.workspaceId],
      foreignColumns: [clients.id, clients.workspaceId],
    }).onDelete('cascade'),
    unique('meal_plans_id_workspace_key').on(table.id, table.workspaceId),
    uniqueIndex('meal_plans_one_active_per_client_idx')
      .on(table.clientId)
      .where(sql`${table.status} = 'active' and ${table.clientId} is not null`),
    index('meal_plans_workspace_id_idx').on(table.workspaceId),
    index('meal_plans_client_id_idx').on(table.clientId),
    check(
      'meal_plans_status_check',
      sql`${table.status} in (${sql.raw(STATUS_VALUES)})`,
    ),
    check(
      'meal_plans_template_or_client_check',
      sql`(${table.isTemplate} and ${table.clientId} is null) or (not ${table.isTemplate} and ${table.clientId} is not null)`,
    ),
    check(
      'meal_plans_targets_check',
      sql`coalesce(${table.caloriesKcalTarget}, 0) >= 0 and coalesce(${table.proteinGTarget}, 0) >= 0 and coalesce(${table.carbsGTarget}, 0) >= 0 and coalesce(${table.fatGTarget}, 0) >= 0`,
    ),
  ],
);

/** One meal. `weekday` NULL means it repeats every day; 1 to 7 pins it to a weekday. */
export const meals = pgTable(
  'meals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    mealPlanId: uuid('meal_plan_id').notNull(),
    weekday: integer('weekday'),
    sortOrder: integer('sort_order').notNull(),
    name: text('name').notNull(),
    suggestedTime: time('suggested_time'),
    category: text('category').$type<MealCategory>(),
    notes: text('notes'),
  },
  (table) => [
    foreignKey({
      name: 'meals_plan_workspace_fk',
      columns: [table.mealPlanId, table.workspaceId],
      foreignColumns: [mealPlans.id, mealPlans.workspaceId],
    }).onDelete('cascade'),
    unique('meals_plan_weekday_sort_order_key')
      .on(table.mealPlanId, table.weekday, table.sortOrder)
      .nullsNotDistinct(),
    unique('meals_id_workspace_key').on(table.id, table.workspaceId),
    check('meals_weekday_check', sql`${table.weekday} between 1 and 7`),
    check(
      'meals_category_check',
      sql`${table.category} in (${sql.raw(
        Object.values(MealCategory)
          .map((v) => `'${v}'`)
          .join(', '),
      )})`,
    ),
  ],
);

/**
 * A food in a meal. It stores both what the coach chose (a quantity of a portion) and what that
 * resolved to (grams and the four macros), copied from the food at save time. The choice is what
 * the editor shows back; the resolution is what is summed, with no join to foods; and the copy
 * means correcting a food next month does not rewrite a plan a client is following.
 */
export const mealItems = pgTable(
  'meal_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    mealId: uuid('meal_id').notNull(),
    recipeId: uuid('recipe_id').references(() => recipes.id),
    foodId: uuid('food_id').references(() => foods.id, {
      onDelete: 'no action',
    }),
    sortOrder: integer('sort_order').notNull(),
    quantity: macro('quantity', 7).notNull(),
    portionId: uuid('portion_id'),
    weightG: macro('weight_g', 7).notNull(),
    itemName: text('item_name').notNull(),
    caloriesKcal: macro('calories_kcal', 7).notNull(),
    proteinG: macro('protein_g').notNull(),
    carbsG: macro('carbs_g').notNull(),
    fatG: macro('fat_g').notNull(),
  },
  (table) => [
    check(
      'meal_items_food_or_recipe_check',
      sql`num_nonnulls(${table.foodId}, ${table.recipeId}) = 1`,
    ),
    foreignKey({
      name: 'meal_items_portion_food_fk',
      columns: [table.portionId, table.foodId],
      foreignColumns: [foodPortions.id, foodPortions.foodId],
    }).onDelete('set null'),
    foreignKey({
      name: 'meal_items_portion_recipe_fk',
      columns: [table.portionId, table.recipeId],
      foreignColumns: [recipePortions.id, recipePortions.recipeId],
    }).onDelete('set null'),
    foreignKey({
      name: 'meal_items_meal_workspace_fk',
      columns: [table.mealId, table.workspaceId],
      foreignColumns: [meals.id, meals.workspaceId],
    }).onDelete('cascade'),
    unique('meal_items_meal_sort_order_key').on(table.mealId, table.sortOrder),
    unique('meal_items_id_workspace_key').on(table.id, table.workspaceId),
    index('meal_items_food_idx').on(table.foodId),
    check('meal_items_quantity_check', sql`${table.quantity} > 0`),
  ],
);

/**
 * An alternative to a meal item with roughly the same macros: the client will not find every item
 * every day, and without a substitute they abandon the plan. It carries the same copied numbers as
 * the item, because it is a complete alternative the client can act on alone.
 */
export const mealItemSubs = pgTable(
  'meal_item_subs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    mealItemId: uuid('meal_item_id').notNull(),
    sortOrder: integer('sort_order').notNull(),
    recipeId: uuid('recipe_id').references(() => recipes.id),
    foodId: uuid('food_id').references(() => foods.id, {
      onDelete: 'no action',
    }),
    quantity: macro('quantity', 7).notNull(),
    portionId: uuid('portion_id'),
    weightG: macro('weight_g', 7).notNull(),
    itemName: text('item_name').notNull(),
    caloriesKcal: macro('calories_kcal', 7).notNull(),
    proteinG: macro('protein_g').notNull(),
    carbsG: macro('carbs_g').notNull(),
    fatG: macro('fat_g').notNull(),
  },
  (table) => [
    check(
      'meal_item_subs_food_or_recipe_check',
      sql`num_nonnulls(${table.foodId}, ${table.recipeId}) = 1`,
    ),
    foreignKey({
      name: 'meal_item_subs_portion_food_fk',
      columns: [table.portionId, table.foodId],
      foreignColumns: [foodPortions.id, foodPortions.foodId],
    }).onDelete('set null'),
    foreignKey({
      name: 'meal_item_subs_portion_recipe_fk',
      columns: [table.portionId, table.recipeId],
      foreignColumns: [recipePortions.id, recipePortions.recipeId],
    }).onDelete('set null'),
    foreignKey({
      name: 'meal_item_subs_item_workspace_fk',
      columns: [table.mealItemId, table.workspaceId],
      foreignColumns: [mealItems.id, mealItems.workspaceId],
    }).onDelete('cascade'),
    unique('meal_item_subs_item_sort_order_key').on(
      table.mealItemId,
      table.sortOrder,
    ),
    index('meal_item_subs_food_idx').on(table.foodId),
  ],
);
