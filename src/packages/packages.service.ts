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
import { StarterPackagesOrchestrator } from './orchestration/starter-packages.orchestrator';

/** The packages module's interface: what a coach sells. */
@Injectable()
export class PackagesService {
  constructor(
    private readonly packageList: PackageListOrchestrator,
    private readonly packageDetails: PackageDetailsOrchestrator,
    private readonly packageCreation: PackageCreationOrchestrator,
    private readonly packageUpdate: PackageUpdateOrchestrator,
    private readonly starterPackages: StarterPackagesOrchestrator,
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

  /** For a workspace that has just been created, inside the transaction that created it. */
  seedStarterPackages(workspaceId: string, currency: string): Promise<void> {
    return this.starterPackages.execute(workspaceId, currency);
  }
}
