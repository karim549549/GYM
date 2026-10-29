import { Injectable } from '@nestjs/common';
import type { Membership } from '../../members/interfaces/membership.interface';

export type WorkspaceSelection =
  | { outcome: 'none' }
  | { outcome: 'selected'; membership: Membership }
  | { outcome: 'must_choose' }
  | { outcome: 'forbidden' };

/**
 * Which workspace a request acts in. A person with one workspace acts in it
 * without saying so; a person with several must say which; nobody may act in a
 * workspace they do not belong to.
 */
@Injectable()
export class WorkspaceSelectionPolicy {
  select(memberships: Membership[], requested?: string): WorkspaceSelection {
    if (requested) {
      const membership = this.findMembership(memberships, requested);
      return membership
        ? { outcome: 'selected', membership }
        : { outcome: 'forbidden' };
    }

    if (memberships.length === 0) {
      return { outcome: 'none' };
    }
    if (memberships.length === 1) {
      return { outcome: 'selected', membership: memberships[0] };
    }
    return { outcome: 'must_choose' };
  }

  private findMembership(
    memberships: Membership[],
    requested: string,
  ): Membership | undefined {
    const id = requested.toLowerCase();
    return memberships.find((candidate) => candidate.workspaceId === id);
  }
}
