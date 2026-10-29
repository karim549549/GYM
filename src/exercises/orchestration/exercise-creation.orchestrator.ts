import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { MuscleListedTwiceException } from '../exceptions/exercise-exceptions';
import { ExercisesQueryHandler } from '../handlers/exercises-query.handler';
import type {
  ExerciseRecord,
  NewExercise,
} from '../interfaces/exercise.interface';

/** Takes over `ExercisesService.create`: the coach adds an exercise of their own, which only they see. */
@Injectable()
export class ExerciseCreationOrchestrator {
  constructor(
    private readonly exercisesQuery: ExercisesQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string, exercise: NewExercise): Promise<ExerciseRecord> {
    const secondary = exercise.secondaryMuscles ?? [];
    if (secondary.includes(exercise.primaryMuscle)) {
      throw new MuscleListedTwiceException();
    }

    return this.transactions.run(
      async () => {
        const id = await this.exercisesQuery.create(workspaceId, exercise);
        await this.exercisesQuery.replaceMuscles(
          workspaceId,
          id,
          exercise.primaryMuscle,
          secondary,
        );
        return (await this.exercisesQuery.findById(id)) as ExerciseRecord;
      },
      { workspaceId },
    );
  }
}
