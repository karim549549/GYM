import { Injectable } from '@nestjs/common';
import type { WorkspaceAction } from '../enums/workspace-action.enum';
import {
  type WorkspaceActor,
  WorkspacePermissionPolicy,
} from '../policies/workspace-permission.policy';

/** Takes over `MembersService.can`: whether a member's role allows an action. */
@Injectable()
export class WorkspaceActionCheckOrchestrator {
  constructor(private readonly permission: WorkspacePermissionPolicy) {}

  execute(actor: WorkspaceActor, action: WorkspaceAction): boolean {
    return this.permission.can(actor, action).outcome === 'allowed';
  }
}
