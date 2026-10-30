import type { ReminderMessageKind } from '../enums/reminder-message-kind.enum';

/** A message the coach wrote. A kind with no row has not been written: the client app shows its default. */
export interface ReminderMessageRecord {
  kind: ReminderMessageKind;
  /** May hold {name}, {days}, {date} and (for the money message) {amount}. */
  body: string;
}
