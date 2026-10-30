import type { ConsentText } from '../../consents/interfaces/consent.interface';
import type { IntakeSubmitter } from '../enums/intake-submitter.enum';
import type { IntakeForm } from './intake-form.interface';

/** A link as the coach hands it on. */
export interface IntakeLinkView {
  token: string;
  /** Where the client opens it, on the web app. */
  url: string;
  expiresAt: Date;
  /** The coach's named form this link asks; null when it asks their default form. */
  namedFormId: string | null;
}

/** A link looked up by its token, with where it leads. */
export interface IntakeLinkTarget {
  id: string;
  workspaceId: string;
  clientId: string;
  expiresAt: Date;
  submittedAt: Date | null;
  namedFormId: string | null;
}

/** What the client sees when they open the link: the coach's brand and the form, nothing else. */
export interface PublicIntakeView {
  coach: { brandName: string; logoUrl: string | null };
  client: { fullName: string };
  expiresAt: Date;
  form: IntakeForm;
  /** What the client is asked to agree to, with the version of each text. */
  consents: ConsentText[];
}

export interface IntakeResponseView {
  submittedAt: Date;
  submittedBy: IntakeSubmitter;
  formVersion: string;
  /** The coach's own form it was answered on, to read the answers against; null for the built-in form. */
  templateId: string | null;
  answers: Record<string, unknown>;
}
