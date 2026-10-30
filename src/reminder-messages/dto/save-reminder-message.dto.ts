import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';

export class SaveReminderMessageDto {
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body: string;
}
