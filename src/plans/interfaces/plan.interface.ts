import type { PlanStatus } from '../enums/plan-status.enum';

export interface PlanSetInput {
  /** Text, because coaches write 8-10, AMRAP and 12 each side. */
  reps?: string;
  weightKg?: number;
  /** Percent of the best single rep, as an alternative to an absolute weight. */
  weightPct?: number;
  restSeconds?: number;
  /** Reps in reserve. */
  rir?: number;
}

export interface PlanExerciseInput {
  exerciseId: string;
  coachNote?: string;
  /** The same letter on neighbouring exercises makes them a superset. */
  supersetGroup?: string;
  /** Their order is their set number. */
  sets: PlanSetInput[];
}

export interface PlanDayInput {
  weekNo: number;
  dayNo: number;
  name?: string;
  isRest?: boolean;
  isDeload?: boolean;
  notes?: string;
  /** Their order is their position on the day. */
  exercises: PlanExerciseInput[];
}

export interface PlanSetRecord {
  setNo: number;
  reps: string | null;
  weightKg: number | null;
  weightPct: number | null;
  restSeconds: number | null;
  rir: number | null;
}

export interface PlanExerciseRecord {
  position: number;
  exerciseId: string;
  /** Copied from the library when the exercise was added. */
  exerciseName: string;
  coachNote: string | null;
  supersetGroup: string | null;
  sets: PlanSetRecord[];
}

export interface PlanDayRecord {
  weekNo: number;
  dayNo: number;
  name: string | null;
  isRest: boolean;
  isDeload: boolean;
  notes: string | null;
  exercises: PlanExerciseRecord[];
}

/** A plan without its days, as listed. */
export interface PlanSummary {
  id: string;
  /** Null for a template. */
  clientId: string | null;
  isTemplate: boolean;
  name: string;
  goal: string | null;
  weeks: number;
  status: PlanStatus;
  startsOn: string | null;
  notes: string | null;
  createdAt: Date;
}

/** A plan with everything in it. */
export interface PlanRecord extends PlanSummary {
  days: PlanDayRecord[];
}

export interface NewPlan {
  name: string;
  goal?: string;
  weeks?: number;
  notes?: string;
  /** A client's plan, or a template when left out. */
  clientId?: string;
  /** Start from a copy of this plan or template. */
  fromPlanId?: string;
}

export interface PlanChanges {
  name?: string;
  goal?: string | null;
  weeks?: number;
  notes?: string | null;
}

export interface PlanListFilter {
  clientId?: string;
  isTemplate?: boolean;
  status?: PlanStatus;
}

/** A day with its exercises resolved: the structure to be stored. */
export interface StoredPlanDay {
  weekNo: number;
  dayNo: number;
  name: string | null;
  isRest: boolean;
  isDeload: boolean;
  notes: string | null;
  exercises: {
    exerciseId: string;
    exerciseName: string;
    coachNote: string | null;
    supersetGroup: string | null;
    sets: PlanSetInput[];
  }[];
}
