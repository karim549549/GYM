import { Injectable } from '@nestjs/common';
import type {
  NewPackage,
  PackageChanges,
  PackageRecord,
} from './interfaces/package.interface';
import { PackageDetailsOrchestrator } from './orchestration/package-details.orchestrator';
import { PackageCreationOrchestrator } from './orchestration/package-creation.orchestrator';
import { PackageListOrchestrator } from './orchestration/package-list.orchestrator';
import { PackageUpdateOrchestrator } from './orchestration/package-update.orchestrator';
import { PackageRemovalOrchestrator } from './orchestration/package-removal.orchestrator';

/** The packages module's interface: what a coach sells. */
@Injectable()
export class PackagesService {
  constructor(
    private readonly packageList: PackageListOrchestrator,
    private readonly packageDetails: PackageDetailsOrchestrator,
    private readonly packageCreation: PackageCreationOrchestrator,
    private readonly packageUpdate: PackageUpdateOrchestrator,
    private readonly packageRemoval: PackageRemovalOrchestrator,
  ) {}

  list(
    workspaceId: string,
    includeInactive: boolean,
  ): Promise<PackageRecord[]> {
    return this.packageList.execute(workspaceId, includeInactive);
  }

  findOne(workspaceId: string, packageId: string): Promise<PackageRecord> {
    return this.packageDetails.execute(workspaceId, packageId);
  }

  create(workspaceId: string, pkg: NewPackage): Promise<PackageRecord> {
    return this.packageCreation.execute(workspaceId, pkg);
  }

  update(
    workspaceId: string,
    packageId: string,
    changes: PackageChanges,
  ): Promise<PackageRecord> {
    return this.packageUpdate.execute(workspaceId, packageId, changes);
  }

  /** Deletes a package nobody bought; `PACKAGE_IN_USE` when subscriptions were sold on it. */
  remove(workspaceId: string, packageId: string): Promise<void> {
    return this.packageRemoval.execute(workspaceId, packageId);
  }
}
