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
import { foodUnits, foods } from './foods.schema';
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
    kcalTarget: integer('kcal_target'),
    proteinTargetG: integer('protein_target_g'),
    carbTargetG: integer('carb_target_g'),
    fatTargetG: integer('fat_target_g'),
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
      sql`coalesce(${table.kcalTarget}, 0) >= 0 and coalesce(${table.proteinTargetG}, 0) >= 0 and coalesce(${table.carbTargetG}, 0) >= 0 and coalesce(${table.fatTargetG}, 0) >= 0`,
    ),
  ],
);

/** One meal. `day_no` 0 means it repeats every day; 1 to 7 pins it to a weekday. */
export const meals = pgTable(
  'meals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    mealPlanId: uuid('meal_plan_id').notNull(),
    dayNo: integer('day_no').notNull().default(0),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    timeHint: time('time_hint'),
    notes: text('notes'),
  },
  (table) => [
    foreignKey({
      name: 'meals_plan_workspace_fk',
      columns: [table.mealPlanId, table.workspaceId],
      foreignColumns: [mealPlans.id, mealPlans.workspaceId],
    }).onDelete('cascade'),
    unique('meals_plan_day_position_key').on(
      table.mealPlanId,
      table.dayNo,
      table.position,
    ),
    unique('meals_id_workspace_key').on(table.id, table.workspaceId),
    check('meals_day_no_check', sql`${table.dayNo} between 0 and 7`),
  ],
);

/**
 * A food in a meal. It stores both what the coach chose (a quantity of a unit) and what that
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
    foodId: uuid('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'no action' }),
    position: integer('position').notNull(),
    quantity: macro('quantity', 7).notNull(),
    unitId: uuid('unit_id').references(() => foodUnits.id, {
      onDelete: 'set null',
    }),
    grams: macro('grams', 7).notNull(),
    foodName: text('food_name').notNull(),
    kcal: macro('kcal', 7).notNull(),
    proteinG: macro('protein_g').notNull(),
    carbG: macro('carb_g').notNull(),
    fatG: macro('fat_g').notNull(),
  },
  (table) => [
    foreignKey({
      name: 'meal_items_meal_workspace_fk',
      columns: [table.mealId, table.workspaceId],
      foreignColumns: [meals.id, meals.workspaceId],
    }).onDelete('cascade'),
    unique('meal_items_meal_position_key').on(table.mealId, table.position),
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
    position: integer('position').notNull(),
    foodId: uuid('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'no action' }),
    quantity: macro('quantity', 7).notNull(),
    unitId: uuid('unit_id').references(() => foodUnits.id, {
      onDelete: 'set null',
    }),
    grams: macro('grams', 7).notNull(),
    foodName: text('food_name').notNull(),
    kcal: macro('kcal', 7).notNull(),
    proteinG: macro('protein_g').notNull(),
    carbG: macro('carb_g').notNull(),
    fatG: macro('fat_g').notNull(),
  },
  (table) => [
    foreignKey({
      name: 'meal_item_subs_item_workspace_fk',
      columns: [table.mealItemId, table.workspaceId],
      foreignColumns: [mealItems.id, mealItems.workspaceId],
    }).onDelete('cascade'),
    unique('meal_item_subs_item_position_key').on(
      table.mealItemId,
      table.position,
    ),
    index('meal_item_subs_food_idx').on(table.foodId),
  ],
);
