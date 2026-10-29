import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';

export class ReplyCheckinDto {
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;
}
