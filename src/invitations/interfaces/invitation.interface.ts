import type { WorkspaceRole } from '../../members/enums/workspace-role.enum';
import type { InvitationState } from '../enums/invitation-state.enum';
import type { InvitationStatus } from '../enums/invitation-status.enum';

export interface StoredInvitation {
  id: string;
  workspaceId: string;
  phone: string;
  role: WorkspaceRole;
  status: InvitationStatus;
  brandName: string;
  expiresAt: Date;
  respondedAt: Date | null;
  createdAt: Date;
}

export interface NewInvitation {
  workspaceId: string;
  phone: string;
  role: WorkspaceRole;
  brandName: string;
  invitedBy: string;
}

/** An invitation as the owner who sent it sees it. */
export interface InvitationRecord {
  id: string;
  phone: string;
  role: WorkspaceRole;
  state: InvitationState;
  expiresAt: Date;
  respondedAt: Date | null;
  createdAt: Date;
}

/** An invitation as the person it is addressed to sees it: who is asking, and for what. */
export interface MyInvitation {
  id: string;
  brandName: string;
  role: WorkspaceRole;
  expiresAt: Date;
  createdAt: Date;
}
