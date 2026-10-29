import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { ExercisesService } from '../../exercises/exercises.service';
import { PlanStatus } from '../enums/plan-status.enum';
import {
  ExerciseNotAvailableException,
  InvalidPlanStructureException,
  PlanEndedException,
} from '../exceptions/plan-exceptions';
import { PlansQueryHandler } from '../handlers/plans-query.handler';
import type {
  PlanDayInput,
  PlanRecord,
  StoredPlanDay,
} from '../interfaces/plan.interface';
import { PlanStructurePolicy } from '../policies/plan-structure.policy';
import { BasePlanOrchestrator } from './base-plan.orchestrator';

/**
 * Takes over `PlansService.replaceDays`: the builder saves the whole plan at once, so the days
 * given become the plan and whatever is not listed is removed. The structure is checked first, then
 * every exercise must be one the coach can use: the library's or their own, and not deactivated
 * unless the plan already holds it (an old plan keeps showing what it was built with). Each
 * exercise's name is copied onto the plan.
 */
@Injectable()
export class PlanStructureOrchestrator extends BasePlanOrchestrator {
  constructor(
    plansQuery: PlansQueryHandler,
    transactions: TransactionManager,
    private readonly exercises: ExercisesService,
    private readonly structurePolicy: PlanStructurePolicy,
  ) {
    super(plansQuery, transactions);
  }

  execute(
    workspaceId: string,
    planId: string,
    days: PlanDayInput[],
  ): Promise<PlanRecord> {
    return this.transactions.run(
      async () => {
        const plan = await this.mustFind(planId);
        if (plan.status === PlanStatus.ENDED) {
          throw new PlanEndedException();
        }

        const checked = this.structurePolicy.check(plan.weeks, days);
        if (checked.outcome === 'invalid') {
          throw new InvalidPlanStructureException(checked.problems);
        }

        const stored = await this.resolve(workspaceId, planId, days);
        await this.plansQuery.replaceDays(workspaceId, planId, stored);
        return this.withDays(plan);
      },
      { workspaceId },
    );
  }

  /** The days with each exercise's name looked up, or the reasons an exercise cannot be used. */
  private async resolve(
    workspaceId: string,
    planId: string,
    days: PlanDayInput[],
  ): Promise<StoredPlanDay[]> {
    const wanted = [
      ...new Set(days.flatMap((day) => day.exercises.map((e) => e.exerciseId))),
    ];
    const found = await this.exercises.findVisible(workspaceId, wanted);
    const alreadyHeld = await this.plansQuery.exerciseIdsOf(planId);
    const known = new Map(found.map((exercise) => [exercise.id, exercise]));
    const held = new Set(alreadyHeld);

    const problems: string[] = [];
    days.forEach((day, d) =>
      day.exercises.forEach((exercise, e) => {
        const match = known.get(exercise.exerciseId);
        if (!match || (!match.isActive && !held.has(match.id))) {
          problems.push(`days[${d}].exercises[${e}].exerciseId: unavailable`);
        }
      }),
    );
    if (problems.length > 0) {
      throw new ExerciseNotAvailableException(problems);
    }

    return days.map((day) => ({
      weekNo: day.weekNo,
      dayNo: day.dayNo,
      name: day.name ?? null,
      isRest: day.isRest ?? false,
      isDeload: day.isDeload ?? false,
      notes: day.notes ?? null,
      exercises: day.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        exerciseName: (known.get(exercise.exerciseId) as { nameAr: string })
          .nameAr,
        coachNote: exercise.coachNote ?? null,
        supersetGroup: exercise.supersetGroup ?? null,
        sets: exercise.sets,
      })),
    }));
  }
}
