import type {
  ConsentState,
  ConsentText,
} from '../../consents/interfaces/consent.interface';
import type { IntakeForm } from '../../intake/interfaces/intake-form.interface';
import type { CheckinFrequency } from '../enums/checkin-frequency.enum';
import type { CheckinStatus } from '../enums/checkin-status.enum';

/** How a client is asked to check in. */
export interface CheckinScheduleRecord {
  frequency: CheckinFrequency;
  /** 0 is Sunday; only a weekly or fortnightly check-in has one. */
  dayOfWeek: number | null;
  /** The hour in Egypt the link goes out. */
  sendHour: number;
  isActive: boolean;
}

export interface CheckinScheduleInput {
  frequency?: CheckinFrequency;
  dayOfWeek?: number;
  sendHour?: number;
}

/** A schedule with where it belongs, for the job that works through all of them. */
export interface ActiveSchedule {
  id: string;
  workspaceId: string;
  clientId: string;
  frequency: CheckinFrequency;
  dayOfWeek: number | null;
  sendHour: number;
}

export interface StoredCheckin {
  id: string;
  clientId: string;
  dueOn: string;
  /** The client's credential. Never handed to the coach as such: they get the link. */
  token: string;
  formVersion: string;
  /** The coach's own form it was answered on, to read the answers against; null for the built-in form. */
  templateId: string | null;
  answers: Record<string, unknown> | null;
  submittedAt: Date | null;
  coachReply: string | null;
  repliedAt: Date | null;
}

/** A check-in as the coach sees it. */
export interface CheckinRecord {
  id: string;
  clientId: string;
  dueOn: string;
  status: CheckinStatus;
  /** Where the client fills it in, for the coach to share by hand if it comes to that. */
  link: string;
  formVersion: string;
  templateId: string | null;
  /** Null when the client has not agreed (or has withdrawn) to the coach reading their health data. */
  answers: Record<string, unknown> | null;
  answersHidden: boolean;
  submittedAt: Date | null;
  coachReply: string | null;
  repliedAt: Date | null;
}

export interface NewCheckin {
  workspaceId: string;
  clientId: string;
  scheduleId: string;
  dueOn: string;
  token: string;
  formVersion: string;
}

export interface CheckinFilter {
  clientId?: string;
  status?: CheckinStatus;
  /** Handed in and not yet answered by the coach. */
  needsReply?: boolean;
}

/** A check-in of a window and what became of it, for a client's progress. */
export interface CheckinActivity {
  dueOn: string;
  submittedAt: Date | null;
  answers: Record<string, unknown> | null;
}

export interface QuietClient {
  clientId: string;
  missedCount: number;
}

/** A check-in found by the secret in its link. */
export interface CheckinLinkTarget {
  id: string;
  workspaceId: string;
  clientId: string;
  dueOn: string;
  submittedAt: Date | null;
}

/** What a client sees when they open the link: the coach's brand and the questions, nothing else. */
export interface PublicCheckinView {
  coach: { brandName: string; logoUrl: string | null };
  client: { fullName: string };
  dueOn: string;
  form: IntakeForm;
  /** The client's own choices, each with the wording to show, so they can change them from here. */
  consents: { texts: ConsentText[]; states: ConsentState[] };
}
