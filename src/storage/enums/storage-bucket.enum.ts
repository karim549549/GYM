/**
 * The buckets that exist on the project. Each file handler names the one it uses.
 * Measurement photos never share a bucket with anything else (Flows, "Photo privacy").
 */
export enum StorageBucket {
  /** Logos and exercise media, which anyone with the link may see. */
  PUBLIC = 'gym-public',
  /** Private files such as payment receipts. */
  FILES = 'gym-files',
  /** Client measurement photos. */
  PHOTOS = 'gym-photos',
}
