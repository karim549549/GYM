import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExercisesService } from '../../exercises/exercises.service';
import { ClientsService } from '../../clients/clients.service';
import type { Env } from '../../config/env.schema';
import { TransactionManager } from '../../database/transaction.manager';
import type { PlanRecord } from '../../plans/interfaces/plan.interface';
import { PlansService } from '../../plans/plans.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { ProgramLinksQueryHandler } from '../handlers/program-links-query.handler';
import type { ExerciseRecord } from '../../exercises/interfaces/exercise.interface';
import type {
  PublicExerciseDetails,
  PublicProgramView,
  PublicWorkoutPlan,
} from '../interfaces/program-link.interface';
import { ProgramLockPolicy } from '../policies/program-lock.policy';
import { BaseProgramAccessOrchestrator } from './base-program-access.orchestrator';

/**
 * Takes over `ProgramLinksService.open`: what a signed-in client sees. Each section is mapped by hand
 * from what the owning module returns, so nothing is shown that was not chosen here: no ids, and not
 * the coach's private notes on the plan. The nutrition section joins here once meal plans can be read.
 */
@Injectable()
export class PublicProgramOrchestrator extends BaseProgramAccessOrchestrator {
  constructor(
    programLinks: ProgramLinksQueryHandler,
    lockPolicy: ProgramLockPolicy,
    clients: ClientsService,
    config: ConfigService<Env, true>,
    transactions: TransactionManager,
    private readonly workspaces: WorkspacesService,
    private readonly plans: PlansService,
    private readonly exercises: ExercisesService,
  ) {
    super(programLinks, lockPolicy, clients, config, transactions);
  }

  async execute(
    token: string,
    session: string | undefined,
  ): Promise<PublicProgramView> {
    const link = await this.openLink(token);
    this.requireSession(link, session);

    const client = await this.clientOf(link);
    const { workspace, plan, library } = await this.transactions.run(
      async () => {
        const found = await this.plans.findActiveOfClient(
          link.workspaceId,
          link.clientId,
        );
        return {
          workspace: await this.workspaces.findCurrent(link.workspaceId),
          plan: found,
          library: found
            ? await this.exercisesOf(link.workspaceId, found)
            : new Map<string, ExerciseRecord>(),
        };
      },
      { workspaceId: link.workspaceId },
    );

    return {
      coach: { brandName: workspace.brandName, logoUrl: workspace.logoUrl },
      client: { firstName: this.firstNameOf(client) },
      workout: plan ? this.workoutOf(plan, library) : null,
      nutrition: null,
    };
  }

  /** The library entry of each exercise the plan uses, once each. One that can no longer be read is left out. */
  private async exercisesOf(
    workspaceId: string,
    plan: PlanRecord,
  ): Promise<Map<string, ExerciseRecord>> {
    const ids = new Set(
      plan.days.flatMap((day) => day.exercises.map((e) => e.exerciseId)),
    );
    const found = await Promise.all(
      [...ids].map((id) =>
        this.exercises.findOne(workspaceId, id).catch(() => null),
      ),
    );
    return new Map(
      found.filter((e): e is ExerciseRecord => e !== null).map((e) => [e.id, e]),
    );
  }

  private detailsOf(exercise: ExerciseRecord | undefined): PublicExerciseDetails | null {
    if (!exercise) {
      return null;
    }
    return {
      nameEn: exercise.nameEn,
      equipment: exercise.equipment,
      difficulty: exercise.difficulty,
      cues: exercise.cues,
      mistakes: exercise.mistakes,
      videoUrl: exercise.videoUrl,
      primaryMuscles: exercise.primaryMuscle ? [exercise.primaryMuscle] : [],
      secondaryMuscles: exercise.secondaryMuscles,
    };
  }

  private workoutOf(
    plan: PlanRecord,
    library: Map<string, ExerciseRecord>,
  ): PublicWorkoutPlan {
    return {
      name: plan.name,
      goal: plan.goal,
      weeks: plan.weeks,
      startsOn: plan.startsOn,
      days: plan.days.map((day) => ({
        weekNo: day.weekNo,
        dayNo: day.dayNo,
        name: day.name,
        isRest: day.isRest,
        isDeload: day.isDeload,
        notes: day.notes,
        exercises: day.exercises.map((exercise) => ({
          exerciseName: exercise.exerciseName,
          details: this.detailsOf(library.get(exercise.exerciseId)),
          supersetGroup: exercise.supersetGroup,
          coachNote: exercise.coachNote,
          sets: exercise.sets.map((set) => ({
            setNo: set.setNo,
            reps: set.reps,
            weightKg: set.weightKg,
            weightPct: set.weightPct,
            restSeconds: set.restSeconds,
            rir: set.rir,
          })),
        })),
      })),
    };
  }
}
