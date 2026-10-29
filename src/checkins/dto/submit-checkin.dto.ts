import { IsObject } from 'class-validator';

export class SubmitCheckinDto {
  /** Checked against the form by the check-in policy, since the questions are data, not fields of this class. */
  @IsObject()
  answers: Record<string, unknown>;
}
