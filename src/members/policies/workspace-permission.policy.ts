import { Injectable } from '@nestjs/common';
import { WorkspaceAction } from '../enums/workspace-action.enum';
import { WorkspaceRole } from '../enums/workspace-role.enum';

export interface WorkspaceActor {
  role?: WorkspaceRole;
  isOwner?: boolean;
}

/**
 * Who may do what inside a workspace: the one `can`. The owner may do everything; a coach who is not
 * the owner everything except running the business (team, billing, settings, revenue analytics); an
 * assistant only the day-to-day running of clients, subscriptions and payments, and never what
 * clients handed in about their bodies or the programmes. A request that names no role gets nothing.
 */
@Injectable()
export class WorkspacePermissionPolicy {
  private static readonly OWNER_ONLY = new Set([
    WorkspaceAction.TEAM_MANAGE,
    WorkspaceAction.BILLING,
    WorkspaceAction.WORKSPACE_SETTINGS,
    WorkspaceAction.BUSINESS_ANALYTICS,
  ]);

  private static readonly ASSISTANT = new Set([
    WorkspaceAction.MEMBER,
    WorkspaceAction.CLIENTS_READ,
    WorkspaceAction.CLIENTS_WRITE,
    WorkspaceAction.SUBSCRIPTIONS_READ,
    WorkspaceAction.SUBSCRIPTIONS_WRITE,
    WorkspaceAction.PAYMENTS_READ,
    WorkspaceAction.PAYMENTS_WRITE,
    WorkspaceAction.CHECKIN_SCHEDULES_MANAGE,
  ]);

  can(
    actor: WorkspaceActor,
    action: WorkspaceAction,
  ): { outcome: 'allowed' | 'refused' } {
    return { outcome: this.allows(actor, action) ? 'allowed' : 'refused' };
  }

  private allows(actor: WorkspaceActor, action: WorkspaceAction): boolean {
    if (actor.isOwner) {
      return true;
    }
    switch (actor.role) {
      case WorkspaceRole.COACH:
        return !WorkspacePermissionPolicy.OWNER_ONLY.has(action);
      case WorkspaceRole.ASSISTANT:
        return WorkspacePermissionPolicy.ASSISTANT.has(action);
      default:
        return false;
    }
  }
}
