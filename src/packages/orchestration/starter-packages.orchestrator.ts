import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PackagesQueryHandler } from '../handlers/packages-query.handler';
import { StarterPackagesPolicy } from '../policies/starter-packages.policy';

/**
 * Takes over `PackagesService.seedStarterPackages`. It runs inside the transaction that
 * has just created the workspace, whose scope the database already set, so it asks for
 * no scope of its own (that would be refused). Outside such a transaction there is no
 * scope and row level security blocks the insert: it fails closed.
 */
@Injectable()
export class StarterPackagesOrchestrator {
  constructor(
    private readonly packagesQuery: PackagesQueryHandler,
    private readonly starterPackages: StarterPackagesPolicy,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string, currency: string): Promise<void> {
    return this.transactions.run(() =>
      this.packagesQuery.createMany(
        workspaceId,
        this.starterPackages.starterPackages(),
        currency,
      ),
    );
  }
}
