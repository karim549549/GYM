import { TransactionManager } from '../../database/transaction.manager';
import { PlanNotFoundException } from '../exceptions/plan-exceptions';
import { PlansQueryHandler } from '../handlers/plans-query.handler';
import type {
  PlanDayRecord,
  PlanRecord,
  PlanSummary,
  StoredPlanDay,
} from '../interfaces/plan.interface';

/** What the flows that read or copy a whole plan share. Call it inside the flow's transaction. */
export abstract class BasePlanOrchestrator {
  constructor(
    protected readonly plansQuery: PlansQueryHandler,
    protected readonly transactions: TransactionManager,
  ) {}

  protected async mustFind(planId: string): Promise<PlanSummary> {
    const found = await this.plansQuery.findSummary(planId);
    if (!found) {
      throw new PlanNotFoundException();
    }
    return found;
  }

  protected async withDays(summary: PlanSummary): Promise<PlanRecord> {
    return { ...summary, days: await this.plansQuery.loadDays(summary.id) };
  }

  /** A plan's days as they would be stored again: a copy keeps the exercise names as they were written. */
  protected asStored(days: PlanDayRecord[]): StoredPlanDay[] {
    return days.map((day) => ({
      weekNo: day.weekNo,
      dayNo: day.dayNo,
      name: day.name,
      isRest: day.isRest,
      isDeload: day.isDeload,
      notes: day.notes,
      exercises: day.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        coachNote: exercise.coachNote,
        supersetGroup: exercise.supersetGroup,
        sets: exercise.sets.map((set) => ({
          reps: set.reps ?? undefined,
          weightKg: set.weightKg ?? undefined,
          weightPct: set.weightPct ?? undefined,
          restSeconds: set.restSeconds ?? undefined,
          rir: set.rir ?? undefined,
        })),
      })),
    }));
  }
}
