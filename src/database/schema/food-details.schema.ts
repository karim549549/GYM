import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { foods } from './foods.schema';
import { people } from './people.schema';
import { workspaces } from './workspaces.schema';
import { NutritionAliasKind } from '../../foods/enums/nutrition-alias-kind.enum';
import { NutrientMeasureUnit } from '../../foods/enums/nutrient-measure-unit.enum';
import { FoodPublicationStatus } from '../../foods/enums/food-publication-status.enum';

export const nutrients = pgTable(
  'nutrients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
    measureUnit: text('measure_unit').$type<NutrientMeasureUnit>().notNull(),
    appearsOnPackageLabel: boolean('appears_on_package_label')
      .notNull()
      .default(false),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    check('nutrients_code_check', sql`${t.code} ~ '^[a-z]+(_[a-z]+)*$'`),
    check(
      'nutrients_measure_unit_check',
      sql`${t.measureUnit} in (${sql.raw(
        Object.values(NutrientMeasureUnit)
          .map((v) => `'${v}'`)
          .join(', '),
      )})`,
    ),
  ],
);
export const foodNutrients = pgTable(
  'food_nutrients',
  {
    foodId: uuid('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id'),
    nutrientId: uuid('nutrient_id')
      .notNull()
      .references(() => nutrients.id),
    amountPer100g: numeric('amount_per_100g', { mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.foodId, t.nutrientId] }),
    foreignKey({
      name: 'food_nutrients_food_workspace_fk',
      columns: [t.foodId, t.workspaceId],
      foreignColumns: [foods.id, foods.workspaceId],
    }).onDelete('cascade'),
    check('food_nutrients_amount_check', sql`${t.amountPer100g} >= 0`),
  ],
);
export const foodAliases = pgTable(
  'food_aliases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    foodId: uuid('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id'),
    kind: text('kind').$type<NutritionAliasKind>().notNull(),
    alias: text('alias').notNull(),
    searchAlias: text('search_alias').notNull().default(''),
  },
  (t) => [
    foreignKey({
      name: 'food_aliases_food_workspace_fk',
      columns: [t.foodId, t.workspaceId],
      foreignColumns: [foods.id, foods.workspaceId],
    }).onDelete('cascade'),
    unique('food_aliases_food_kind_search_key').on(
      t.foodId,
      t.kind,
      t.searchAlias,
    ),
    check(
      'food_aliases_kind_check',
      sql`${t.kind} in (${sql.raw(
        Object.values(NutritionAliasKind)
          .map((v) => `'${v}'`)
          .join(', '),
      )})`,
    ),
    index('food_aliases_search_alias_trgm_idx').using(
      'gin',
      t.searchAlias.op('gin_trgm_ops'),
    ),
  ],
);
export const foodPublicationRequests = pgTable(
  'food_publication_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    foodId: uuid('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' }),
    status: text('status')
      .$type<FoodPublicationStatus>()
      .notNull()
      .default(FoodPublicationStatus.PENDING),
    duplicateOfFoodId: uuid('duplicate_of_food_id').references(() => foods.id),
    contentFingerprint: text('content_fingerprint').notNull(),
    reviewerNote: text('reviewer_note'),
    requestedAt: timestamp('requested_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedBy: uuid('reviewed_by').references(() => people.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: 'food_publication_requests_food_workspace_fk',
      columns: [t.foodId, t.workspaceId],
      foreignColumns: [foods.id, foods.workspaceId],
    }).onDelete('cascade'),
    uniqueIndex('food_publication_requests_one_pending_idx')
      .on(t.foodId)
      .where(sql`${t.status} = 'pending'`),
    check(
      'food_publication_requests_status_check',
      sql`${t.status} in (${sql.raw(
        Object.values(FoodPublicationStatus)
          .map((v) => `'${v}'`)
          .join(', '),
      )})`,
    ),
  ],
);
