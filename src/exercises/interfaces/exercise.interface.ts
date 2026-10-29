import type { BodySide } from '../enums/body-side.enum';
import type { Difficulty } from '../enums/difficulty.enum';
import type { Equipment } from '../enums/equipment.enum';
import type { ExercisePattern } from '../enums/exercise-pattern.enum';
import type { MuscleId } from '../enums/muscle-id.enum';

export interface MuscleRecord {
  id: string;
  labelAr: string;
  labelEn: string;
  /** The path in the anatomy drawing to fill in. */
  svgPathId: string;
  bodySide: BodySide;
}

export interface ExerciseRecord {
  id: string;
  /** What the client sees. */
  nameAr: string;
  /** Usually what the coach searches by. */
  nameEn: string;
  /** Only the library's own exercises have one. */
  slug: string | null;
  equipment: Equipment[];
  difficulty: Difficulty;
  pattern: ExercisePattern | null;
  cues: string[];
  mistakes: string[];
  /** A YouTube link, embedded in the page rather than linked out. */
  videoUrl: string | null;
  isActive: boolean;
  /** True for a coach's own addition, false for the library's. */
  isCustom: boolean;
  primaryMuscle: MuscleId | null;
  secondaryMuscles: MuscleId[];
}

export interface NewExercise {
  nameAr: string;
  nameEn: string;
  equipment?: Equipment[];
  difficulty?: Difficulty;
  pattern?: ExercisePattern;
  cues?: string[];
  mistakes?: string[];
  videoUrl?: string;
  primaryMuscle: MuscleId;
  secondaryMuscles?: MuscleId[];
}

/** What a coach may change on their own exercise. `null` clears the pattern or the video. */
export interface ExerciseChanges {
  nameAr?: string;
  nameEn?: string;
  equipment?: Equipment[];
  difficulty?: Difficulty;
  pattern?: ExercisePattern | null;
  cues?: string[];
  mistakes?: string[];
  videoUrl?: string | null;
  isActive?: boolean;
  primaryMuscle?: MuscleId;
  secondaryMuscles?: MuscleId[];
}

export interface ExerciseListFilter {
  /** Part of either name; the characters of a pattern are plain text. */
  search?: string;
  /** Exercises that need any of these. */
  equipment?: Equipment[];
  /** A muscle the exercise works, primary or secondary. */
  muscle?: MuscleId;
  difficulty?: Difficulty;
  pattern?: ExercisePattern;
  includeInactive?: boolean;
}

/** The little a plan needs to know about an exercise to hold it. */
export interface ExerciseSummary {
  id: string;
  nameAr: string;
  isActive: boolean;
}
