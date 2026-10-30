import type { CheckinFrequency } from '../../checkins/enums/checkin-frequency.enum';
import type { PackageInclude } from '../enums/package-include.enum';

export interface PackageRecord {
  id: string;
  name: string;
  durationDays: number;
  /** In minor units (piastres): 150000 is EGP 1,500.00. Format for display at the edge only. */
  priceMinor: number;
  currency: string;
  isActive: boolean;
  checkInFrequency: CheckinFrequency | null;
  includes: PackageInclude[];
  description: string | null;
}

export interface NewPackage {
  name: string;
  durationDays: number;
  priceMinor: number;
  checkInFrequency?: CheckinFrequency;
  includes?: PackageInclude[];
  description?: string;
}

/** What a coach may change. A package is never deleted, only deactivated. null clears a field. */
export interface PackageChanges {
  name?: string;
  durationDays?: number;
  priceMinor?: number;
  isActive?: boolean;
  checkInFrequency?: CheckinFrequency | null;
  includes?: PackageInclude[];
  description?: string | null;
}
