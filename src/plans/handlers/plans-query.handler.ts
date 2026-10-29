import { Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, max, ne } from 'drizzle-orm';
import {
  BaseQueryHandler,
  type PaginatedResponse,
} from '../../common/handlers/base-query.handler';
import {
  planDays,
  planExercises,
  planSets,
  plans,
} from '../../database/schema';
import { PlanStatus } from '../enums/plan-status.enum';
import type {
  NewPlan,
  PlanChanges,
  PlanDayRecord,
  PlanListFilter,
  PlanSummary,
  StoredPlanDay,
} from '../interfaces/plan.interface';

const SUMMARY = {
  id: plans.id,
  clientId: plans.clientId,
  isTemplate: plans.isTemplate,
  name: plans.name,
  goal: plans.goal,
  weeks: plans.weeks,
  status: plans.status,
  startsOn: plans.startsOn,
  notes: plans.notes,
  createdAt: plans.createdAt,
};

/** Rows are inserted in chunks: a long plan has far more values than one statement may carry. */
const CHUNK = 1500;

/** Data access for the four tables of a workout plan. Row level security keeps it to one workspace. */
@Injectable()
export class PlansQueryHandler extends BaseQueryHandler {
  async create(
    workspaceId: string,
    createdBy: string | null,
    plan: Required<Pick<NewPlan, 'name' | 'weeks'>> &
      Pick<NewPlan, 'goal' | 'notes' | 'clientId'>,
  ): Promise<PlanSummary> {
    const [created] = await this.db
      .insert(plans)
      .values({
        workspaceId,
        createdBy,
        clientId: plan.clientId ?? null,
        isTemplate: plan.clientId === undefined,
        name: plan.name,
        goal: plan.goal ?? null,
        weeks: plan.weeks,
        notes: plan.notes ?? null,
      })
      .returning(SUMMARY);
    return created;
  }

  /** Several templates in one go, for a new workspace. */
  createTemplates(
    workspaceId: string,
    templates: { name: string; goal: string; weeks: number }[],
  ): Promise<PlanSummary[]> {
    return this.db
      .insert(plans)
      .values(
        templates.map((template) => ({
          workspaceId,
          isTemplate: true,
          ...template,
        })),
      )
      .returning(SUMMARY);
  }

  async findSummary(id: string): Promise<PlanSummary | null> {
    const rows = await this.db
      .select(SUMMARY)
      .from(plans)
      .where(eq(plans.id, id))
      .limit(1);
    return this.firstOrNull(rows);
  }

  list(
    filter: PlanListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<PlanSummary>> {
    const where = and(
      filter.clientId ? eq(plans.clientId, filter.clientId) : undefined,
      filter.isTemplate !== undefined
        ? eq(plans.isTemplate, filter.isTemplate)
        : undefined,
      filter.status ? eq(plans.status, filter.status) : undefined,
    );
    return this.executePageQuery(
      {
        fetchItems: (take, skip) =>
          this.db
            .select(SUMMARY)
            .from(plans)
            .where(where)
            .orderBy(desc(plans.createdAt), desc(plans.id))
            .limit(take)
            .offset(skip),
        count: async () => {
          const [row] = await this.db
            .select({ total: count() })
            .from(plans)
            .where(where);
          return row.total;
        },
      },
      page,
      limit,
    );
  }

  async update(id: string, changes: PlanChanges): Promise<PlanSummary | null> {
    const set = {
      ...(changes.name !== undefined && { name: changes.name }),
      ...(changes.goal !== undefined && { goal: changes.goal }),
      ...(changes.weeks !== undefined && { weeks: changes.weeks }),
      ...(changes.notes !== undefined && { notes: changes.notes }),
    };
    if (Object.keys(set).length === 0) {
      return this.findSummary(id);
    }
    const rows = await this.db
      .update(plans)
      .set(set)
      .where(eq(plans.id, id))
      .returning(SUMMARY);
    return this.firstOrNull(rows);
  }

  async remove(id: string): Promise<void> {
    await this.db.delete(plans).where(eq(plans.id, id));
  }

  async setStatus(
    id: string,
    status: PlanStatus,
    startsOn?: string,
  ): Promise<void> {
    await this.db
      .update(plans)
      .set({ status, ...(startsOn !== undefined && { startsOn }) })
      .where(eq(plans.id, id));
  }

  /** Ends the client's running plan, if there is one, apart from `exceptId`. */
  async endActiveOfClient(clientId: string, exceptId: string): Promise<void> {
    await this.db
      .update(plans)
      .set({ status: PlanStatus.ENDED })
      .where(
        and(
          eq(plans.clientId, clientId),
          eq(plans.status, PlanStatus.ACTIVE),
          ne(plans.id, exceptId),
        ),
      );
  }

  async lastWeekOf(planId: string): Promise<number> {
    const [row] = await this.db
      .select({ last: max(planDays.weekNo) })
      .from(planDays)
      .where(eq(planDays.planId, planId));
    return row?.last ?? 0;
  }

  async exerciseIdsOf(planId: string): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ id: planExercises.exerciseId })
      .from(planExercises)
      .innerJoin(planDays, eq(planDays.id, planExercises.planDayId))
      .where(eq(planDays.planId, planId));
    return rows.map((row) => row.id);
  }

  /** The whole structure, in reading order: weeks, days, exercises, sets. */
  async loadDays(planId: string): Promise<PlanDayRecord[]> {
    const days = await this.db
      .select()
      .from(planDays)
      .where(eq(planDays.planId, planId))
      .orderBy(asc(planDays.weekNo), asc(planDays.dayNo));
    if (days.length === 0) {
      return [];
    }
    const exercises = await this.db
      .select()
      .from(planExercises)
      .where(
        inArray(
          planExercises.planDayId,
          days.map((day) => day.id),
        ),
      )
      .orderBy(asc(planExercises.position));
    const sets =
      exercises.length === 0
        ? []
        : await this.db
            .select()
            .from(planSets)
            .where(
              inArray(
                planSets.planExerciseId,
                exercises.map((exercise) => exercise.id),
              ),
            )
            .orderBy(asc(planSets.setNo));

    return days.map((day) => ({
      weekNo: day.weekNo,
      dayNo: day.dayNo,
      name: day.name,
      isRest: day.isRest,
      isDeload: day.isDeload,
      notes: day.notes,
      exercises: exercises
        .filter((exercise) => exercise.planDayId === day.id)
        .map((exercise) => ({
          position: exercise.position,
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          coachNote: exercise.coachNote,
          supersetGroup: exercise.supersetGroup,
          sets: sets
            .filter((set) => set.planExerciseId === exercise.id)
            .map((set) => ({
              setNo: set.setNo,
              reps: set.reps,
              weightKg: set.weightKg,
              weightPct: set.weightPct,
              restSeconds: set.restSeconds,
              rir: set.rir,
            })),
        })),
    }));
  }

  /** Replaces the whole structure with these days. Exercises and sets go with the days they belong to. */
  async replaceDays(
    workspaceId: string,
    planId: string,
    days: StoredPlanDay[],
  ): Promise<void> {
    await this.db.delete(planDays).where(eq(planDays.planId, planId));
    await this.insertDays(workspaceId, [{ planId, days }]);
  }

  /**
   * Stores the days of several new plans together, in three statements however many plans there are:
   * a new workspace gets its starter templates this way, and every round trip is a wait for the coach.
   */
  async insertDays(
    workspaceId: string,
    plansToFill: { planId: string; days: StoredPlanDay[] }[],
  ): Promise<void> {
    const days = plansToFill.flatMap(({ planId, days: own }) =>
      own.map((day) => ({ planId, day })),
    );
    if (days.length === 0) {
      return;
    }

    const dayRows = await this.insertChunked(days, (chunk) =>
      this.db
        .insert(planDays)
        .values(
          chunk.map(({ planId, day }) => ({
            workspaceId,
            planId,
            weekNo: day.weekNo,
            dayNo: day.dayNo,
            name: day.name,
            isRest: day.isRest,
            isDeload: day.isDeload,
            notes: day.notes,
          })),
        )
        .returning({
          id: planDays.id,
          planId: planDays.planId,
          weekNo: planDays.weekNo,
          dayNo: planDays.dayNo,
        }),
    );
    const dayId = new Map(
      dayRows.map((row) => [
        `${row.planId}:${row.weekNo}:${row.dayNo}`,
        row.id,
      ]),
    );

    const wanted = days.flatMap(({ planId, day }) =>
      day.exercises.map((exercise, index) => ({
        dayId: dayId.get(`${planId}:${day.weekNo}:${day.dayNo}`) as string,
        exercise,
        position: index + 1,
      })),
    );
    if (wanted.length === 0) {
      return;
    }
    const exerciseRows = await this.insertChunked(wanted, (chunk) =>
      this.db
        .insert(planExercises)
        .values(
          chunk.map(({ dayId: planDayId, exercise, position }) => ({
            workspaceId,
            planDayId,
            exerciseId: exercise.exerciseId,
            position,
            exerciseName: exercise.exerciseName,
            coachNote: exercise.coachNote,
            supersetGroup: exercise.supersetGroup,
          })),
        )
        .returning({
          id: planExercises.id,
          planDayId: planExercises.planDayId,
          position: planExercises.position,
        }),
    );
    const exerciseId = new Map(
      exerciseRows.map((row) => [`${row.planDayId}:${row.position}`, row.id]),
    );

    const setRows = wanted.flatMap(({ dayId: planDayId, exercise, position }) =>
      exercise.sets.map((set, index) => ({
        workspaceId,
        planExerciseId: exerciseId.get(`${planDayId}:${position}`) as string,
        setNo: index + 1,
        reps: set.reps ?? null,
        weightKg: set.weightKg ?? null,
        weightPct: set.weightPct ?? null,
        restSeconds: set.restSeconds ?? null,
        rir: set.rir ?? null,
      })),
    );
    await this.insertChunked(setRows, (chunk) =>
      this.db.insert(planSets).values(chunk).returning({ id: planSets.id }),
    );
  }

  private async insertChunked<T, R>(
    rows: T[],
    insert: (chunk: T[]) => Promise<R[]>,
  ): Promise<R[]> {
    const done: R[] = [];
    for (let at = 0; at < rows.length; at += CHUNK) {
      done.push(...(await insert(rows.slice(at, at + CHUNK))));
    }
    return done;
  }
}
