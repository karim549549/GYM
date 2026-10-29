import { Module } from '@nestjs/common';
import { MembersModule } from '../members/members.module';
import { StorageModule } from '../storage/storage.module';
import { WorkspaceFileHandler } from './handlers/workspace-file.handler';
import { WorkspacesQueryHandler } from './handlers/workspaces-query.handler';
import { WorkspaceCreationOrchestrator } from './orchestration/workspace-creation.orchestrator';
import { WorkspaceDetailsOrchestrator } from './orchestration/workspace-details.orchestrator';
import { WorkspaceLogoRemovalOrchestrator } from './orchestration/workspace-logo-removal.orchestrator';
import { WorkspaceLogoOrchestrator } from './orchestration/workspace-logo.orchestrator';
import { WorkspaceUpdateOrchestrator } from './orchestration/workspace-update.orchestrator';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [MembersModule, StorageModule],
  controllers: [WorkspacesController],
  providers: [
    WorkspacesService,
    WorkspacesQueryHandler,
    WorkspaceCreationOrchestrator,
    WorkspaceDetailsOrchestrator,
    WorkspaceUpdateOrchestrator,
    WorkspaceLogoOrchestrator,
    WorkspaceLogoRemovalOrchestrator,
    WorkspaceFileHandler,
  ],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
