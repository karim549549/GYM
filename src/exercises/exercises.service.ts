import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import type {
  ExerciseChanges,
  ExerciseListFilter,
  ExerciseRecord,
  ExerciseSummary,
  MuscleRecord,
  NewExercise,
} from './interfaces/exercise.interface';
import { ExerciseCreationOrchestrator } from './orchestration/exercise-creation.orchestrator';
import { ExerciseDetailsOrchestrator } from './orchestration/exercise-details.orchestrator';
import { ExerciseListOrchestrator } from './orchestration/exercise-list.orchestrator';
import { ExerciseSummariesOrchestrator } from './orchestration/exercise-summaries.orchestrator';
import { ExerciseUpdateOrchestrator } from './orchestration/exercise-update.orchestrator';
import { ExerciseLibraryLookupOrchestrator } from './orchestration/exercise-library-lookup.orchestrator';
import { MuscleListOrchestrator } from './orchestration/muscle-list.orchestrator';

/** The exercises module's interface: the library plans are built from. */
@Injectable()
export class ExercisesService {
  constructor(
    private readonly muscleList: MuscleListOrchestrator,
    private readonly exerciseList: ExerciseListOrchestrator,
    private readonly exerciseDetails: ExerciseDetailsOrchestrator,
    private readonly exerciseCreation: ExerciseCreationOrchestrator,
    private readonly exerciseUpdate: ExerciseUpdateOrchestrator,
    private readonly exerciseSummaries: ExerciseSummariesOrchestrator,
    private readonly libraryLookup: ExerciseLibraryLookupOrchestrator,
  ) {}

  muscles(): Promise<MuscleRecord[]> {
    return this.muscleList.execute();
  }

  list(
    workspaceId: string,
    filter: ExerciseListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<ExerciseRecord>> {
    return this.exerciseList.execute(workspaceId, filter, page, limit);
  }

  findOne(workspaceId: string, exerciseId: string): Promise<ExerciseRecord> {
    return this.exerciseDetails.execute(workspaceId, exerciseId);
  }

  create(workspaceId: string, exercise: NewExercise): Promise<ExerciseRecord> {
    return this.exerciseCreation.execute(workspaceId, exercise);
  }

  update(
    workspaceId: string,
    exerciseId: string,
    changes: ExerciseChanges,
  ): Promise<ExerciseRecord> {
    return this.exerciseUpdate.execute(workspaceId, exerciseId, changes);
  }

  /** For starter plans: the library's exercises by handle. Needs no workspace, so it works inside the transaction that creates one. */
  findLibraryBySlugs(
    slugs: string[],
  ): Promise<{ id: string; slug: string | null; nameAr: string }[]> {
    return this.libraryLookup.execute(slugs);
  }

  /** For plans: which of these the workspace can use, with the name to keep. */
  findVisible(
    workspaceId: string,
    exerciseIds: string[],
  ): Promise<ExerciseSummary[]> {
    return this.exerciseSummaries.execute(workspaceId, exerciseIds);
  }
}
