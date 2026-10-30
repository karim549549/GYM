import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import {
  PackageInUseException,
  PackageNotFoundException,
} from '../exceptions/package-exceptions';
import { PackagesQueryHandler } from '../handlers/packages-query.handler';

/**
 * Takes over `PackagesService.remove`. A package nobody bought can go. Once a subscription was
 * sold on it the database keeps it (subscriptions point at it), and the coach stops selling it
 * with `isActive: false` instead.
 */
@Injectable()
export class PackageRemovalOrchestrator {
  constructor(
    private readonly packagesQuery: PackagesQueryHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(workspaceId: string, packageId: string): Promise<void> {
    let removed: boolean;
    try {
      removed = await this.transactions.run(
        () => this.packagesQuery.remove(packageId),
        { workspaceId },
      );
    } catch (error) {
      throw PackageInUseException.causes(error)
        ? new PackageInUseException()
        : error;
    }
    if (!removed) {
      throw new PackageNotFoundException();
    }
  }
}
