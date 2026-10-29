/** One reading on a client's chart. */
export interface MeasurementPoint {
  metric: string;
  unit: string;
  value: number;
  /** The day it was measured, YYYY-MM-DD. */
  date: string;
}
