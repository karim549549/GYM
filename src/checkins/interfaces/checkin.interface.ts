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
  /** 0 is Sunday; only a weekly or fortnightly check-in uses it. */
  dayOfWeek: number;
  /** The time in Egypt the link goes out, HH:MM. */
  sendAt: string;
  /** The first day check-ins are asked for, YYYY-MM-DD. */
  startsOn: string;
  isActive: boolean;
}

/** A client's schedule with whose it is, for the list of all of them. */
export interface ClientCheckinSchedule extends CheckinScheduleRecord {
  clientId: string;
}

export interface CheckinScheduleInput {
  frequency?: CheckinFrequency;
  dayOfWeek?: number;
  sendAt?: string;
  startsOn?: string;
}

/** A schedule with where it belongs, for the job that works through all of them. */
export interface ActiveSchedule {
  id: string;
  workspaceId: string;
  clientId: string;
  frequency: CheckinFrequency;
  dayOfWeek: number;
  sendAt: string;
  startsOn: string;
}

/** What the clients list shows of a client's check-ins. */
export interface ClientCheckinOverview {
  clientId: string;
  /** The next check-in still to come, YYYY-MM-DD, or null when none is planned. */
  nextDueOn: string | null;
  /** Check-ins missed in the last thirty days. */
  missedCount: number;
}

/** The same, with the days until the next one worked out in Egypt's calendar. */
export interface ClientCheckinDays {
  clientId: string;
  /** Days until the next check-in; 0 is today. null when none is planned. */
  nextInDays: number | null;
  missedCount: number;
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
  /** Due on or after this day. */
  dueFrom?: string;
  /** Due on or before this day. */
  dueTo?: string;
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
