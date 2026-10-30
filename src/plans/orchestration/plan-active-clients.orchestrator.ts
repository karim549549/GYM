import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PlansQueryHandler } from '../handlers/plans-query.handler';

/** Takes over `PlansService.clientsWithActivePlan`: which of these clients follow a plan now. */
@Injectable()
export class PlanActiveClientsOrchestrator {
  constructor(
    private readonly plansQuery: PlansQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string, clientIds: string[]): Promise<string[]> {
    return this.transactions.run(
      () => this.plansQuery.clientIdsWithActivePlan(clientIds),
      { workspaceId },
    );
  }
}
