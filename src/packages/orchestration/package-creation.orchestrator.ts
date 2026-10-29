import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { PackagesQueryHandler } from '../handlers/packages-query.handler';
import type {
  NewPackage,
  PackageRecord,
} from '../interfaces/package.interface';

/**
 * Takes over `PackagesService.create`. The package is priced in the workspace's currency,
 * which the workspaces module owns, so it is asked for rather than read from its table.
 */
@Injectable()
export class PackageCreationOrchestrator {
  constructor(
    private readonly packagesQuery: PackagesQueryHandler,
    private readonly workspaces: WorkspacesService,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string, pkg: NewPackage): Promise<PackageRecord> {
    return this.transactions.run(
      async () => {
        const { currency } = await this.workspaces.findCurrent(workspaceId);
        return this.packagesQuery.create(workspaceId, pkg, currency);
      },
      { workspaceId },
    );
  }
}
