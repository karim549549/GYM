export interface PackageRecord {
  id: string;
  name: string;
  durationDays: number;
  /** In minor units (piastres): 150000 is EGP 1,500.00. Format for display at the edge only. */
  priceMinor: number;
  currency: string;
  isActive: boolean;
}

export interface NewPackage {
  name: string;
  durationDays: number;
  priceMinor: number;
}

/** What a coach may change. A package is never deleted, only deactivated. */
export interface PackageChanges {
  name?: string;
  durationDays?: number;
  priceMinor?: number;
  isActive?: boolean;
}
