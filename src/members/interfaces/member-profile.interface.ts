import type { Specialty } from '../enums/specialty.enum';

/** How a coach presents themselves; it is theirs in one workspace, not the person's everywhere. */
export interface MemberProfile {
  specialties: Specialty[];
  bio: string | null;
  instagram: string | null;
}

/** What a coach may change. null clears a field; leaving it out keeps it. */
export interface MemberProfileChanges {
  specialties?: Specialty[];
  bio?: string | null;
  instagram?: string | null;
}
