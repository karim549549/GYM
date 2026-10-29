import type { QuestionType } from '../../intake/enums/question-type.enum';
import type { FormPurpose } from '../enums/form-purpose.enum';

export interface FormChoice {
  /** What is kept in the answer. */
  value: string;
  /** What the person reads. */
  labelAr: string;
}

/** A question as the coach writes it. */
export interface FormQuestionInput {
  labelAr: string;
  labelEn?: string;
  /** A line of help under the question. */
  helpText?: string;
  inputType: QuestionType;
  /** For the select types. */
  options?: FormChoice[];
  isRequired?: boolean;
  /** Shown beside a number, such as kg. */
  unit?: string;
  /** A number tagged `weight` is also saved as a measurement, so the charts keep working. */
  mapsToMetric?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  maxLength?: number;
}

/** A question as it is kept and shown. */
export interface FormQuestionRecord {
  /** The key its answer is kept under: a uuid for the coach's own, a name for the built-in form. */
  id: string;
  position: number;
  labelAr: string;
  labelEn: string | null;
  helpText: string | null;
  inputType: QuestionType;
  options: FormChoice[] | null;
  isRequired: boolean;
  unit: string | null;
  mapsToMetric: string | null;
  min: number | null;
  max: number | null;
  integer: boolean;
  maxLength: number | null;
}

export interface FormRecord {
  purpose: FormPurpose;
  /** False while the coach is on the built-in form. */
  isCustom: boolean;
  /** `default_v1` for the built-in form, `custom_v3` for the coach's third version. */
  version: string;
  templateId: string | null;
  questions: FormQuestionRecord[];
}

/** A question once checked and ready to be stored. */
export interface StoredFormQuestion {
  labelAr: string;
  labelEn: string | null;
  helpText: string | null;
  inputType: QuestionType;
  options: FormChoice[] | null;
  isRequired: boolean;
  unit: string | null;
  mapsToMetric: string | null;
  min: number | null;
  max: number | null;
  integer: boolean;
  maxLength: number | null;
}

export interface StoredFormTemplate {
  id: string;
  purpose: FormPurpose;
  version: number;
  isActive: boolean;
}
