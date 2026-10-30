import { IsEnum } from 'class-validator';
import { ReminderMessageKind } from '../enums/reminder-message-kind.enum';

export class ReminderMessageParamsDto {
  @IsEnum(ReminderMessageKind)
  kind: ReminderMessageKind;
}
