import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { ExercisesQueryHandler } from '../handlers/exercises-query.handler';

/**
 * Takes over `ExercisesService.findLibraryBySlugs`. The library is the same for everyone, so this
 * asks for no workspace scope: it joins whatever transaction is open, including the one that is
 * creating a workspace and whose scope the database has already set.
 */
@Injectable()
export class ExerciseLibraryLookupOrchestrator {
  constructor(
    private readonly exercisesQuery: ExercisesQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    slugs: string[],
  ): Promise<{ id: string; slug: string | null; nameAr: string }[]> {
    return this.transactions.run(() =>
      this.exercisesQuery.findLibraryBySlugs(slugs),
    );
  }
}
