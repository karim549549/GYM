import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../../common/handlers/base-query.handler';
import { TransactionManager } from '../../database/transaction.manager';
import { ExercisesQueryHandler } from '../handlers/exercises-query.handler';
import type {
  ExerciseListFilter,
  ExerciseRecord,
} from '../interfaces/exercise.interface';

/** Takes over `ExercisesService.list`: the library and the coach's own exercises, by name. */
@Injectable()
export class ExerciseListOrchestrator {
  constructor(
    private readonly exercisesQuery: ExercisesQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    filter: ExerciseListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<ExerciseRecord>> {
    return this.transactions.run(
      () => this.exercisesQuery.list(filter, page, limit),
      { workspaceId },
    );
  }
}
