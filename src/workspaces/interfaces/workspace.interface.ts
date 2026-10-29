import type { UnitSystem } from '../enums/unit-system.enum';

export interface NewWorkspace {
  brandName: string;
  /** The person who creates the workspace and owns it. */
  ownerId: string;
}

export interface CreatedWorkspace {
  id: string;
  slug: string;
  brandName: string;
  currency: string;
}

/** A workspace as its coach sees and edits it. */
export interface WorkspaceDetails {
  id: string;
  slug: string;
  brandName: string;
  logoUrl: string | null;
  currency: string;
  unitSystem: UnitSystem;
  expiryAlertDays: number;
}

/** A workspace as stored: the logo is a key, and the address is built when it is read. */
export type WorkspaceRow = Omit<WorkspaceDetails, 'logoUrl'> & {
  logoKey: string | null;
};

/** What a coach may change. The handle and the id never change. */
export interface WorkspaceChanges {
  brandName?: string;
  currency?: string;
  unitSystem?: UnitSystem;
  expiryAlertDays?: number;
}
