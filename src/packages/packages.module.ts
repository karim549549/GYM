import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { PackagesQueryHandler } from './handlers/packages-query.handler';
import { PackageCreationOrchestrator } from './orchestration/package-creation.orchestrator';
import { PackageDetailsOrchestrator } from './orchestration/package-details.orchestrator';
import { PackageListOrchestrator } from './orchestration/package-list.orchestrator';
import { PackageUpdateOrchestrator } from './orchestration/package-update.orchestrator';
import { PackageRemovalOrchestrator } from './orchestration/package-removal.orchestrator';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';

@Module({
  imports: [WorkspacesModule],
  controllers: [PackagesController],
  providers: [
    PackagesService,
    PackagesQueryHandler,
    PackageListOrchestrator,
    PackageDetailsOrchestrator,
    PackageCreationOrchestrator,
    PackageUpdateOrchestrator,
    PackageRemovalOrchestrator,
  ],
  exports: [PackagesService],
})
export class PackagesModule {}
