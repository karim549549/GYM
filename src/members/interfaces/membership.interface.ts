import type { WorkspaceRole } from '../enums/workspace-role.enum';

/** A person's place in one workspace. */
export interface Membership {
  workspaceId: string;
  role: WorkspaceRole;
  isOwner: boolean;
}
