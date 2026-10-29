import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import {
  ExerciseNotEditableException,
  ExerciseNotFoundException,
  MuscleListedTwiceException,
} from '../exceptions/exercise-exceptions';
import { ExercisesQueryHandler } from '../handlers/exercises-query.handler';
import type {
  ExerciseChanges,
  ExerciseRecord,
} from '../interfaces/exercise.interface';

/**
 * Takes over `ExercisesService.update`: change what was sent and leave the rest. Only the coach's
 * own exercises change; the library's are the same for everyone. Sending either muscle field
 * replaces the muscles together, keeping whichever was not sent.
 */
@Injectable()
export class ExerciseUpdateOrchestrator {
  constructor(
    private readonly exercisesQuery: ExercisesQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    exerciseId: string,
    changes: ExerciseChanges,
  ): Promise<ExerciseRecord> {
    return this.transactions.run(
      async () => {
        const found = await this.exercisesQuery.findById(exerciseId);
        if (!found) {
          throw new ExerciseNotFoundException();
        }
        if (!found.isCustom) {
          throw new ExerciseNotEditableException();
        }

        const primary = changes.primaryMuscle ?? found.primaryMuscle;
        const secondary = changes.secondaryMuscles ?? found.secondaryMuscles;
        if (primary && secondary.includes(primary)) {
          throw new MuscleListedTwiceException();
        }

        await this.exercisesQuery.update(exerciseId, changes);
        if (
          primary &&
          (changes.primaryMuscle !== undefined ||
            changes.secondaryMuscles !== undefined)
        ) {
          await this.exercisesQuery.replaceMuscles(
            workspaceId,
            exerciseId,
            primary,
            secondary,
          );
        }
        return (await this.exercisesQuery.findById(
          exerciseId,
        )) as ExerciseRecord;
      },
      { workspaceId },
    );
  }
}
