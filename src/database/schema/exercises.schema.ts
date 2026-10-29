import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { Difficulty } from '../../exercises/enums/difficulty.enum';
import { ExercisePattern } from '../../exercises/enums/exercise-pattern.enum';
import { MuscleRole } from '../../exercises/enums/muscle-role.enum';
import { muscles } from './muscles.schema';
import { workspaces } from './workspaces.schema';

const inList = (values: string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(', '));

/**
 * The exercise library, global and a coach's own in one table: no workspace means everyone sees
 * it, a workspace means it is that coach's private addition. Never deleted, only deactivated,
 * because plans point at it and must keep rendering.
 */
export const exercises = pgTable(
  'exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, {
      onDelete: 'cascade',
    }),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
    /** A stable handle for the library's own exercises, so seeded templates can name them. */
    slug: text('slug'),
    equipment: text('equipment')
      .array()
      .notNull()
      .default(sql`'{}'`),
    difficulty: text('difficulty')
      .$type<Difficulty>()
      .notNull()
      .default(Difficulty.BEGINNER),
    pattern: text('pattern').$type<ExercisePattern>(),
    cues: text('cues')
      .array()
      .notNull()
      .default(sql`'{}'`),
    mistakes: text('mistakes')
      .array()
      .notNull()
      .default(sql`'{}'`),
    videoUrl: text('video_url'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // lets the muscle rows prove they are in the exercise's own workspace
    unique('exercises_id_workspace_key').on(table.id, table.workspaceId),
    // the library's own exercises are told apart by slug
    uniqueIndex('exercises_global_slug_idx')
      .on(table.slug)
      .where(sql`${table.workspaceId} is null`),
    index('exercises_workspace_id_idx').on(table.workspaceId),
    index('exercises_equipment_idx').using('gin', table.equipment),
    check(
      'exercises_difficulty_check',
      sql`${table.difficulty} in (${inList(Object.values(Difficulty))})`,
    ),
    check(
      'exercises_pattern_check',
      sql`${table.pattern} is null or ${table.pattern} in (${inList(Object.values(ExercisePattern))})`,
    ),
  ],
);

/** Which muscles an exercise works, and how. The same workspace as the exercise, or none for a library one. */
export const exerciseMuscles = pgTable(
  'exercise_muscles',
  {
    exerciseId: uuid('exercise_id').notNull(),
    workspaceId: uuid('workspace_id'),
    muscleId: text('muscle_id')
      .notNull()
      .references(() => muscles.id, { onDelete: 'restrict' }),
    role: text('role').$type<MuscleRole>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.exerciseId, table.muscleId] }),
    foreignKey({
      name: 'exercise_muscles_exercise_workspace_fk',
      columns: [table.exerciseId, table.workspaceId],
      foreignColumns: [exercises.id, exercises.workspaceId],
    }).onDelete('cascade'),
    index('exercise_muscles_muscle_idx').on(table.muscleId),
    check(
      'exercise_muscles_role_check',
      sql`${table.role} in (${inList(Object.values(MuscleRole))})`,
    ),
  ],
);
