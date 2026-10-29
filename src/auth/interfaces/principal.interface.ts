import type { WorkspaceRole } from '../../members/enums/workspace-role.enum';
import type { Membership } from '../../members/interfaces/membership.interface';

/** Who is making the request, as the backend understands it. */
export interface Principal {
  personId: string;
  authUserId: string;
  fullName: string;
  memberships: Membership[];
  /** The workspace this request acts in, when the person acts as a coach. */
  workspaceId?: string;
  role?: WorkspaceRole;
  isOwner?: boolean;
}
