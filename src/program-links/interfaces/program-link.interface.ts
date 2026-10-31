/** A program link as the flows need it: who it is for and where its password and lockout stand. */
export interface ProgramLinkTarget {
  id: string;
  workspaceId: string;
  clientId: string;
  token: string;
  /** Null until the client has chosen a password. */
  passwordHash: string | null;
  /** Goes up each time the coach resets access: sessions signed with an older number are void. */
  sessionVersion: number;
  failedAttempts: number;
  lockedUntil: Date | null;
}

/** What the coach gets: the address to send, and whether the client has chosen a password yet. */
export interface ProgramLinkView {
  token: string;
  url: string;
  hasPassword: boolean;
}

/** What anyone with the address sees before signing in: whose it is, and which form to show. */
export interface ProgramGateView {
  coach: { brandName: string; logoUrl: string | null };
  client: { firstName: string };
  hasPassword: boolean;
}

/** A signed session for one device, good until `expiresAt`. */
export interface ProgramSessionResult {
  session: string;
  expiresAt: Date;
}

export interface PublicWorkoutSet {
  setNo: number;
  reps: string | null;
  weightKg: number | null;
  weightPct: number | null;
  restSeconds: number | null;
  rir: number | null;
}

/** What the client may read about an exercise: how to do it, what it works, the video. No ids. */
export interface PublicExerciseDetails {
  nameEn: string;
  equipment: string[];
  difficulty: string;
  cues: string[];
  mistakes: string[];
  videoUrl: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
}

export interface PublicWorkoutExercise {
  exerciseName: string;
  /** Null when the library exercise can no longer be read. */
  details: PublicExerciseDetails | null;
  supersetGroup: string | null;
  coachNote: string | null;
  sets: PublicWorkoutSet[];
}

export interface PublicWorkoutDay {
  weekNo: number;
  dayNo: number;
  name: string | null;
  isRest: boolean;
  isDeload: boolean;
  notes: string | null;
  exercises: PublicWorkoutExercise[];
}

/** The workout plan as the client sees it: no ids, and not the coach's private notes on the plan. */
export interface PublicWorkoutPlan {
  name: string;
  goal: string | null;
  weeks: number;
  startsOn: string | null;
  days: PublicWorkoutDay[];
}

/**
 * Everything a signed-in client sees. A section is null while there is nothing to show; `nutrition`
 * is reserved so the meal plan joins the same link later without a new address or a new login.
 */
export interface PublicProgramView {
  coach: { brandName: string; logoUrl: string | null };
  client: { firstName: string };
  workout: PublicWorkoutPlan | null;
  nutrition: null;
}
