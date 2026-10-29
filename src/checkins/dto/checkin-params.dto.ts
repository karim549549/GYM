import { IsUUID } from 'class-validator';

export class CheckinParamsDto {
  @IsUUID()
  id: string;
}
