import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { RecipesQueryHandler } from '../handlers/recipes-query.handler';
@Injectable()
export class RecipeLookupOrchestrator {
  constructor(
    private readonly query: RecipesQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}
  execute(workspaceId: string, ids: string[]) {
    return this.transactions.run(() => this.query.findMany(ids), {
      workspaceId,
    });
  }
}
