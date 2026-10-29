import type { WorkspaceRole } from '../../members/enums/workspace-role.enum';
import type { Membership } from '../../members/interfaces/membership.interface';

export interface MeResponse {
  personId: string;
  fullName: string;
  workspaces: Membership[];
  activeWorkspaceId?: string;
  role?: WorkspaceRole;
  isOwner?: boolean;
}
