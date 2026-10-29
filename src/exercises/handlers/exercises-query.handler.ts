import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import {
  BaseQueryHandler,
  type PaginatedResponse,
} from '../../common/handlers/base-query.handler';
import { exerciseMuscles, exercises, muscles } from '../../database/schema';
import { MuscleRole } from '../enums/muscle-role.enum';
import type { MuscleId } from '../enums/muscle-id.enum';
import type {
  ExerciseChanges,
  ExerciseListFilter,
  ExerciseRecord,
  ExerciseSummary,
  MuscleRecord,
  NewExercise,
} from '../interfaces/exercise.interface';

const ROW = {
  id: exercises.id,
  workspaceId: exercises.workspaceId,
  nameAr: exercises.nameAr,
  nameEn: exercises.nameEn,
  slug: exercises.slug,
  equipment: exercises.equipment,
  difficulty: exercises.difficulty,
  pattern: exercises.pattern,
  cues: exercises.cues,
  mistakes: exercises.mistakes,
  videoUrl: exercises.videoUrl,
  isActive: exercises.isActive,
};

type Row = {
  id: string;
  workspaceId: string | null;
  nameAr: string;
  nameEn: string;
  slug: string | null;
  equipment: string[];
  difficulty: ExerciseRecord['difficulty'];
  pattern: ExerciseRecord['pattern'];
  cues: string[];
  mistakes: string[];
  videoUrl: string | null;
  isActive: boolean;
};

/**
 * Data access for `exercises`, `exercise_muscles` and `muscles`. Row level security lets a workspace
 * read the library and its own additions, and write only its own.
 */
@Injectable()
export class ExercisesQueryHandler extends BaseQueryHandler {
  listMuscles(): Promise<MuscleRecord[]> {
    return this.db
      .select({
        id: muscles.id,
        labelAr: muscles.labelAr,
        labelEn: muscles.labelEn,
        svgPathId: muscles.svgPathId,
        bodySide: muscles.bodySide,
      })
      .from(muscles)
      .orderBy(asc(muscles.id));
  }

  list(
    filter: ExerciseListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<ExerciseRecord>> {
    const where = and(
      filter.includeInactive ? undefined : eq(exercises.isActive, true),
      filter.search ? this.matching(filter.search) : undefined,
      filter.equipment?.length
        ? sql`${exercises.equipment} && ${this.textArray(filter.equipment)}`
        : undefined,
      filter.muscle ? this.worksMuscle(filter.muscle) : undefined,
      filter.difficulty
        ? eq(exercises.difficulty, filter.difficulty)
        : undefined,
      filter.pattern ? eq(exercises.pattern, filter.pattern) : undefined,
    );
    return this.executePageQuery(
      {
        fetchItems: (take, skip) =>
          this.db
            .select(ROW)
            .from(exercises)
            .where(where)
            .orderBy(asc(exercises.nameEn), asc(exercises.id))
            .limit(take)
            .offset(skip),
        count: async () => {
          const [row] = await this.db
            .select({ total: count() })
            .from(exercises)
            .where(where);
          return row.total;
        },
      },
      page,
      limit,
      (rows) => this.withMuscles(rows),
    );
  }

  async findById(id: string): Promise<ExerciseRecord | null> {
    const rows = await this.db
      .select(ROW)
      .from(exercises)
      .where(eq(exercises.id, id))
      .limit(1);
    return this.firstOrNull(await this.withMuscles(rows));
  }

  /** Those of these ids the workspace can see (the library's and its own). */
  findSummaries(ids: string[]): Promise<ExerciseSummary[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.db
      .select({
        id: exercises.id,
        nameAr: exercises.nameAr,
        isActive: exercises.isActive,
      })
      .from(exercises)
      .where(inArray(exercises.id, ids));
  }

  /** The library's own exercises with these handles. Readable with or without a workspace scope. */
  findLibraryBySlugs(
    slugs: string[],
  ): Promise<{ id: string; slug: string | null; nameAr: string }[]> {
    return this.db
      .select({
        id: exercises.id,
        slug: exercises.slug,
        nameAr: exercises.nameAr,
      })
      .from(exercises)
      .where(
        and(isNull(exercises.workspaceId), inArray(exercises.slug, slugs)),
      );
  }

  async create(workspaceId: string, exercise: NewExercise): Promise<string> {
    const [created] = await this.db
      .insert(exercises)
      .values({
        workspaceId,
        nameAr: exercise.nameAr,
        nameEn: exercise.nameEn,
        equipment: exercise.equipment ?? [],
        difficulty: exercise.difficulty,
        pattern: exercise.pattern,
        cues: exercise.cues ?? [],
        mistakes: exercise.mistakes ?? [],
        videoUrl: exercise.videoUrl,
      })
      .returning({ id: exercises.id });
    return created.id;
  }

  /** Sets only the fields given (the muscles are separate). False when nothing of the workspace's own matched. */
  async update(id: string, changes: ExerciseChanges): Promise<boolean> {
    const set = {
      ...(changes.nameAr !== undefined && { nameAr: changes.nameAr }),
      ...(changes.nameEn !== undefined && { nameEn: changes.nameEn }),
      ...(changes.equipment !== undefined && { equipment: changes.equipment }),
      ...(changes.difficulty !== undefined && {
        difficulty: changes.difficulty,
      }),
      ...(changes.pattern !== undefined && { pattern: changes.pattern }),
      ...(changes.cues !== undefined && { cues: changes.cues }),
      ...(changes.mistakes !== undefined && { mistakes: changes.mistakes }),
      ...(changes.videoUrl !== undefined && { videoUrl: changes.videoUrl }),
      ...(changes.isActive !== undefined && { isActive: changes.isActive }),
    };
    if (Object.keys(set).length === 0) {
      return true;
    }
    const rows = await this.db
      .update(exercises)
      .set(set)
      .where(eq(exercises.id, id))
      .returning({ id: exercises.id });
    return rows.length > 0;
  }

  async replaceMuscles(
    workspaceId: string,
    exerciseId: string,
    primary: MuscleId,
    secondary: MuscleId[],
  ): Promise<void> {
    await this.db
      .delete(exerciseMuscles)
      .where(eq(exerciseMuscles.exerciseId, exerciseId));
    await this.db.insert(exerciseMuscles).values([
      { exerciseId, workspaceId, muscleId: primary, role: MuscleRole.PRIMARY },
      ...secondary.map((muscleId) => ({
        exerciseId,
        workspaceId,
        muscleId,
        role: MuscleRole.SECONDARY,
      })),
    ]);
  }

  private async withMuscles(rows: Row[]): Promise<ExerciseRecord[]> {
    if (rows.length === 0) {
      return [];
    }
    const links = await this.db
      .select({
        exerciseId: exerciseMuscles.exerciseId,
        muscleId: exerciseMuscles.muscleId,
        role: exerciseMuscles.role,
      })
      .from(exerciseMuscles)
      .where(
        inArray(
          exerciseMuscles.exerciseId,
          rows.map((row) => row.id),
        ),
      );

    return rows.map(({ workspaceId, ...row }) => {
      const own = links.filter((link) => link.exerciseId === row.id);
      return {
        ...row,
        equipment: row.equipment as ExerciseRecord['equipment'],
        isCustom: workspaceId !== null,
        primaryMuscle:
          (own.find((link) => link.role === MuscleRole.PRIMARY)
            ?.muscleId as MuscleId) ?? null,
        secondaryMuscles: own
          .filter((link) => link.role === MuscleRole.SECONDARY)
          .map((link) => link.muscleId as MuscleId)
          .sort(),
      };
    });
  }

  private worksMuscle(muscle: MuscleId) {
    return inArray(
      exercises.id,
      this.db
        .select({ id: exerciseMuscles.exerciseId })
        .from(exerciseMuscles)
        .where(eq(exerciseMuscles.muscleId, muscle)),
    );
  }

  private textArray(values: string[]) {
    return sql`ARRAY[${sql.join(
      values.map((value) => sql`${value}`),
      sql`, `,
    )}]::text[]`;
  }

  private matching(search: string) {
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    return or(
      ilike(exercises.nameEn, pattern),
      ilike(exercises.nameAr, pattern),
    );
  }
}
