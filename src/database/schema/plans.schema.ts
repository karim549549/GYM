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
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { PlanStatus } from '../../plans/enums/plan-status.enum';
import { clients } from './clients.schema';
import { exercises } from './exercises.schema';
import { people } from './people.schema';
import { workspaces } from './workspaces.schema';

const STATUS_VALUES = Object.values(PlanStatus)
  .map((status) => `'${status}'`)
  .join(', ');

/**
 * A workout plan, for one client or as a template, in one table: "save this as a template" is a
 * copy, not a conversion between two shapes. A plan is weeks, of days, of exercises, of sets.
 */
export const plans = pgTable(
  'plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Null for a template. */
    clientId: uuid('client_id'),
    isTemplate: boolean('is_template').notNull().default(false),
    name: text('name').notNull(),
    goal: text('goal'),
    weeks: integer('weeks').notNull().default(4),
    status: text('status')
      .$type<PlanStatus>()
      .notNull()
      .default(PlanStatus.DRAFT),
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
      name: 'plans_client_workspace_fk',
      columns: [table.clientId, table.workspaceId],
      foreignColumns: [clients.id, clients.workspaceId],
    }).onDelete('cascade'),
    unique('plans_id_workspace_key').on(table.id, table.workspaceId),
    // a client has one active plan: the database refuses a second
    uniqueIndex('plans_one_active_per_client_idx')
      .on(table.clientId)
      .where(sql`${table.status} = 'active' and ${table.clientId} is not null`),
    index('plans_workspace_id_idx').on(table.workspaceId),
    index('plans_client_id_idx').on(table.clientId),
    check('plans_weeks_check', sql`${table.weeks} between 1 and 52`),
    check(
      'plans_status_check',
      sql`${table.status} in (${sql.raw(STATUS_VALUES)})`,
    ),
    check(
      'plans_template_or_client_check',
      sql`(${table.isTemplate} and ${table.clientId} is null) or (not ${table.isTemplate} and ${table.clientId} is not null)`,
    ),
  ],
);

/** One day of one week of a plan. A rest day is a day with no exercises. */
export const planDays = pgTable(
  'plan_days',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id').notNull(),
    weekNo: integer('week_no').notNull(),
    dayNo: integer('day_no').notNull(),
    name: text('name'),
    isRest: boolean('is_rest').notNull().default(false),
    isDeload: boolean('is_deload').notNull().default(false),
    notes: text('notes'),
  },
  (table) => [
    foreignKey({
      name: 'plan_days_plan_workspace_fk',
      columns: [table.planId, table.workspaceId],
      foreignColumns: [plans.id, plans.workspaceId],
    }).onDelete('cascade'),
    unique('plan_days_plan_week_day_key').on(
      table.planId,
      table.weekNo,
      table.dayNo,
    ),
    unique('plan_days_id_workspace_key').on(table.id, table.workspaceId),
    check('plan_days_week_no_check', sql`${table.weekNo} > 0`),
    check('plan_days_day_no_check', sql`${table.dayNo} between 1 and 7`),
  ],
);

/**
 * An exercise on a day. The exercise's name is copied here, so the plan keeps reading the way it
 * was written even if the library entry is renamed or deactivated.
 */
export const planExercises = pgTable(
  'plan_exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    planDayId: uuid('plan_day_id').notNull(),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'no action' }),
    position: integer('position').notNull(),
    exerciseName: text('exercise_name').notNull(),
    coachNote: text('coach_note'),
    /** The same letter on neighbouring exercises makes them a superset. */
    supersetGroup: text('superset_group'),
  },
  (table) => [
    foreignKey({
      name: 'plan_exercises_day_workspace_fk',
      columns: [table.planDayId, table.workspaceId],
      foreignColumns: [planDays.id, planDays.workspaceId],
    }).onDelete('cascade'),
    unique('plan_exercises_day_position_key').on(
      table.planDayId,
      table.position,
    ),
    unique('plan_exercises_id_workspace_key').on(table.id, table.workspaceId),
    index('plan_exercises_exercise_idx').on(table.exerciseId),
  ],
);

/** One set of an exercise. `reps` is text because coaches write 8-10, AMRAP and 12 each side. */
export const planSets = pgTable(
  'plan_sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    planExerciseId: uuid('plan_exercise_id').notNull(),
    setNo: integer('set_no').notNull(),
    reps: text('reps'),
    weightKg: numeric('weight_kg', {
      precision: 6,
      scale: 2,
      mode: 'number',
    }),
    /** Percent of the best single rep, as an alternative to an absolute weight. */
    weightPct: numeric('weight_pct', {
      precision: 5,
      scale: 2,
      mode: 'number',
    }),
    restSeconds: integer('rest_seconds'),
    /** Reps in reserve. */
    rir: numeric('rir', { precision: 3, scale: 1, mode: 'number' }),
  },
  (table) => [
    foreignKey({
      name: 'plan_sets_exercise_workspace_fk',
      columns: [table.planExerciseId, table.workspaceId],
      foreignColumns: [planExercises.id, planExercises.workspaceId],
    }).onDelete('cascade'),
    unique('plan_sets_exercise_set_key').on(table.planExerciseId, table.setNo),
    check('plan_sets_weight_kg_check', sql`${table.weightKg} >= 0`),
    check(
      'plan_sets_weight_pct_check',
      sql`${table.weightPct} between 0 and 200`,
    ),
    check('plan_sets_rest_check', sql`${table.restSeconds} between 0 and 3600`),
    check('plan_sets_rir_check', sql`${table.rir} between 0 and 10`),
  ],
);
