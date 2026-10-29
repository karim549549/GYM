import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { PackageNotFoundException } from '../exceptions/package-exceptions';
import { PackagesQueryHandler } from '../handlers/packages-query.handler';
import type { PackageRecord } from '../interfaces/package.interface';

/** Takes over `PackagesService.findOne`: one package of the workspace, active or not. */
@Injectable()
export class PackageDetailsOrchestrator {
  constructor(
    private readonly packagesQuery: PackagesQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(
    workspaceId: string,
    packageId: string,
  ): Promise<PackageRecord> {
    const found = await this.transactions.run(
      () => this.packagesQuery.findById(packageId),
      { workspaceId },
    );
    if (!found) {
      throw new PackageNotFoundException();
    }
    return found;
  }
}
