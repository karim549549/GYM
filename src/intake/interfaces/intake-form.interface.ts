import type { Reading } from '../../measurements/interfaces/reading.interface';
import type { QuestionType } from '../enums/question-type.enum';

/**
 * One question. The wording is not here: the apps translate by `id`, so the same form reads
 * in Arabic and English. Everything the server needs to check an answer is.
 */
export interface IntakeQuestion {
  id: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  integer?: boolean;
  maxLength?: number;
  /** Shown next to a number. */
  unit?: string;
  /** When set, the answer is also saved as a measurement under this name. */
  metric?: string;
  /** What the person sees. A form the coach wrote carries its wording; the built-in one is translated by id. */
  labelAr?: string;
  labelEn?: string;
  helpText?: string;
  /** The options as the person reads them: a value to keep and its wording. */
  choices?: { value: string; labelAr: string }[];
}

export interface IntakeForm {
  version: string;
  /** The coach's own form this is, when it is one; the built-in one has none. */
  templateId?: string;
  units: { weight: string; height: string };
  questions: IntakeQuestion[];
}

export type IntakeCheck =
  | {
      outcome: 'valid';
      /** What to keep: only what was answered, with text trimmed. */
      answers: Record<string, unknown>;
      readings: Reading[];
    }
  | { outcome: 'invalid'; problems: string[] };
