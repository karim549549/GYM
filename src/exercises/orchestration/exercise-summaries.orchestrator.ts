import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { ExercisesQueryHandler } from '../handlers/exercises-query.handler';
import type { ExerciseSummary } from '../interfaces/exercise.interface';

/**
 * Takes over `ExercisesService.findVisible`, for the modules that hold exercises (plans): which of
 * these ids the workspace can use, with the name to keep on the plan. One it cannot see is absent.
 */
@Injectable()
export class ExerciseSummariesOrchestrator {
  constructor(
    private readonly exercisesQuery: ExercisesQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    exerciseIds: string[],
  ): Promise<ExerciseSummary[]> {
    return this.transactions.run(
      () => this.exercisesQuery.findSummaries(exerciseIds),
      { workspaceId },
    );
  }
}
