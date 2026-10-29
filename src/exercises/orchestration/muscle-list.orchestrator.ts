import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { ExercisesQueryHandler } from '../handlers/exercises-query.handler';
import type { MuscleRecord } from '../interfaces/exercise.interface';

/** Takes over `ExercisesService.muscles`: the twenty muscles of the anatomy drawing, the same for everyone. */
@Injectable()
export class MuscleListOrchestrator {
  constructor(
    private readonly exercisesQuery: ExercisesQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(): Promise<MuscleRecord[]> {
    return this.transactions.run(() => this.exercisesQuery.listMuscles());
  }
}
