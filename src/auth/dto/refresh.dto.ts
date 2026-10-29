import { IsNotEmpty, IsString } from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';

export class RefreshDto {
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
