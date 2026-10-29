import { Injectable } from '@nestjs/common';
import type {
  CreatedWorkspace,
  NewWorkspace,
  WorkspaceChanges,
  WorkspaceDetails,
} from './interfaces/workspace.interface';
import { WorkspaceCreationOrchestrator } from './orchestration/workspace-creation.orchestrator';
import { WorkspaceDetailsOrchestrator } from './orchestration/workspace-details.orchestrator';
import { WorkspaceLogoRemovalOrchestrator } from './orchestration/workspace-logo-removal.orchestrator';
import { WorkspaceLogoOrchestrator } from './orchestration/workspace-logo.orchestrator';
import { WorkspaceUpdateOrchestrator } from './orchestration/workspace-update.orchestrator';

/** The workspaces module's interface: the tenant every coach's data hangs from. */
@Injectable()
export class WorkspacesService {
  constructor(
    private readonly workspaceCreation: WorkspaceCreationOrchestrator,
    private readonly workspaceDetails: WorkspaceDetailsOrchestrator,
    private readonly workspaceUpdate: WorkspaceUpdateOrchestrator,
    private readonly workspaceLogo: WorkspaceLogoOrchestrator,
    private readonly workspaceLogoRemoval: WorkspaceLogoRemovalOrchestrator,
  ) {}

  create(workspace: NewWorkspace): Promise<CreatedWorkspace> {
    return this.workspaceCreation.execute(workspace);
  }

  findCurrent(workspaceId: string): Promise<WorkspaceDetails> {
    return this.workspaceDetails.execute(workspaceId);
  }

  setLogo(
    workspaceId: string,
    bytes: Uint8Array,
  ): Promise<{ logoUrl: string }> {
    return this.workspaceLogo.execute(workspaceId, bytes);
  }

  removeLogo(workspaceId: string): Promise<void> {
    return this.workspaceLogoRemoval.execute(workspaceId);
  }

  updateCurrent(
    workspaceId: string,
    changes: WorkspaceChanges,
  ): Promise<WorkspaceDetails> {
    return this.workspaceUpdate.execute(workspaceId, changes);
  }
}
