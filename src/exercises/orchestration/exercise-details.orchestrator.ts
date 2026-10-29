import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { ExerciseNotFoundException } from '../exceptions/exercise-exceptions';
import { ExercisesQueryHandler } from '../handlers/exercises-query.handler';
import type { ExerciseRecord } from '../interfaces/exercise.interface';

/** Takes over `ExercisesService.findOne`: a library exercise or one of the coach's own, active or not. */
@Injectable()
export class ExerciseDetailsOrchestrator {
  constructor(
    private readonly exercisesQuery: ExercisesQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(
    workspaceId: string,
    exerciseId: string,
  ): Promise<ExerciseRecord> {
    const found = await this.transactions.run(
      () => this.exercisesQuery.findById(exerciseId),
      { workspaceId },
    );
    if (!found) {
      throw new ExerciseNotFoundException();
    }
    return found;
  }
}
