import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { RecipesQueryHandler } from '../handlers/recipes-query.handler';
import { ListRecipesQueryDto } from '../dto/list-recipes.query.dto';
@Injectable()
export class RecipeListOrchestrator {
  constructor(
    private readonly query: RecipesQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}
  execute(workspaceId: string, query: ListRecipesQueryDto) {
    return this.transactions.run(() => this.query.list(query), { workspaceId });
  }
}
