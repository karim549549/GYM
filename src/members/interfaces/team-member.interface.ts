import type { WorkspaceRole } from '../enums/workspace-role.enum';

/** A member of a workspace as the owner sees the team. */
export interface TeamMember {
  personId: string;
  fullName: string;
  phone: string;
  role: WorkspaceRole;
  isOwner: boolean;
  joinedAt: Date;
}

/** A member row before the person's details are added to it. */
export interface StoredMember {
  personId: string;
  role: WorkspaceRole;
  isOwner: boolean;
  joinedAt: Date;
}
