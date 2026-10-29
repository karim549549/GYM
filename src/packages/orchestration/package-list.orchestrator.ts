import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PackagesQueryHandler } from '../handlers/packages-query.handler';
import type { PackageRecord } from '../interfaces/package.interface';

/** Takes over `PackagesService.list`: the packages of the workspace the coach is acting in. */
@Injectable()
export class PackageListOrchestrator {
  constructor(
    private readonly packagesQuery: PackagesQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  execute(
    workspaceId: string,
    includeInactive: boolean,
  ): Promise<PackageRecord[]> {
    return this.transactions.run(
      () => this.packagesQuery.list(includeInactive),
      { workspaceId },
    );
  }
}
