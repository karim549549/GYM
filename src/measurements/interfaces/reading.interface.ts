/** One number about a client, as it is measured: a metric, its value and its unit. */
export interface Reading {
  /** A key from code (weight, height, sleep_quality...), not a foreign key: new ones are not a migration. */
  metric: string;
  value: number;
  unit: string;
}
