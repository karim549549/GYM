/** One point of a chart: a day and what was measured. */
export interface SeriesPoint {
  /** YYYY-MM-DD. */
  date: string;
  value: number;
}

export interface MetricSeries {
  metric: string;
  unit: string;
  points: SeriesPoint[];
}

export interface WeightProgress {
  unit: string | null;
  points: SeriesPoint[];
  /** The target weight the coach or client set, drawn as the chart's line. */
  target: number | null;
  first: SeriesPoint | null;
  latest: SeriesPoint | null;
  /** Latest minus first, in the weight's unit. */
  change: number | null;
  /** Units per week over the last four weeks; negative is losing. Null with fewer than two readings there. */
  weeklyRate: number | null;
}

/** How closely a client followed their plans, from the check-ins of the last four weeks. */
export interface Adherence {
  /** Average days out of seven they followed the nutrition plan, in percent. Null when they said nothing. */
  nutritionPct: number | null;
  trainingPct: number | null;
  /** Check-ins handed in out of those that were due, in percent. Null when none were due. */
  checkinRatePct: number | null;
}

export interface ClientProgress {
  weight: WeightProgress;
  /** Every other measurement that has readings, such as waist, chest and arm. */
  measurements: MetricSeries[];
  /** The last four weeks. */
  adherence: Adherence;
  /** Whole weeks since the client's first subscription began. */
  weeksCompleted: number | null;
  /** When they last handed in a check-in. */
  lastCheckinAt: Date | null;
}

/** A check-in of the window, as the progress needs it. */
export interface CheckinSummary {
  dueOn: string;
  submittedAt: Date | null;
  answers: Record<string, unknown> | null;
}

export interface MonthWindow {
  /** YYYY-MM. */
  month: string;
  /** First and last day of the month. */
  from: string;
  to: string;
}

export interface MonthlyRevenue {
  month: string;
  totalMinor: number;
}

export interface MonthlyClients {
  month: string;
  /** Clients with a subscription covering the month's last day (or today, for the current month). */
  activeClients: number;
}

export interface BusinessAnalytics {
  /** The last six months, oldest first, the current one included. */
  revenue: MonthlyRevenue[];
  activeClients: MonthlyClients[];
  /** Of the subscriptions that ended in the last 90 days, the share the client renewed, in percent. Null when none ended. */
  renewalRatePct: number | null;
  /** Average days from a client's first subscription to the end of their last. Null with no clients yet. */
  averageClientLifetimeDays: number | null;
  /** Revenue of the six months over the clients who paid in them, in minor units. Null when nobody paid. */
  averageRevenuePerClientMinor: number | null;
  /** Clients who missed two or more check-ins in the last 30 days. */
  atRiskClients: number;
}
