import type { ReminderAudience } from '../enums/reminder-audience.enum';
import type { ReminderKind } from '../enums/reminder-kind.enum';
import type { ReminderSubjectType } from '../enums/reminder-subject-type.enum';

/** The subscription a reminder is planned for. */
export interface SubscriptionReminderSubject {
  clientId: string;
  subscriptionId: string;
  /** The last day of the subscription, YYYY-MM-DD. */
  endsOn: string;
}

/** A check-in the client is to be sent the link to. */
export interface CheckinReminderSubject {
  clientId: string;
  checkinId: string;
  /** The day it is due, YYYY-MM-DD. */
  dueOn: string;
  /** The time in Egypt the link goes out, HH:MM. */
  sendAt: string;
  /** Where the client fills it in. */
  link: string;
}

export interface NewReminder {
  workspaceId: string;
  subjectType: ReminderSubjectType;
  clientId: string;
  subjectId: string;
  kind: ReminderKind;
  audience: ReminderAudience;
  scheduledFor: Date;
  payload: Record<string, string>;
}

/** A reminder the sender has taken and now has to deliver. */
export interface ClaimedReminder {
  id: string;
  workspaceId: string;
  clientId: string;
  kind: ReminderKind;
  audience: ReminderAudience;
  payload: Record<string, string>;
}
