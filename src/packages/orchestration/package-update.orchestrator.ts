import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PackageNotFoundException } from '../exceptions/package-exceptions';
import { PackagesQueryHandler } from '../handlers/packages-query.handler';
import type {
  PackageChanges,
  PackageRecord,
} from '../interfaces/package.interface';

/** Takes over `PackagesService.update`: change what was sent, leave the rest. */
@Injectable()
export class PackageUpdateOrchestrator {
  constructor(
    private readonly packagesQuery: PackagesQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(
    workspaceId: string,
    packageId: string,
    changes: PackageChanges,
  ): Promise<PackageRecord> {
    const updated = await this.transactions.run(
      () =>
        Object.values(changes).some((value) => value !== undefined)
          ? this.packagesQuery.update(packageId, changes)
          : this.packagesQuery.findById(packageId),
      { workspaceId },
    );
    if (!updated) {
      throw new PackageNotFoundException();
    }
    return updated;
  }
}
