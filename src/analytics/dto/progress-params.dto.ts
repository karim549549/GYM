import { IsUUID } from 'class-validator';

export class ProgressParamsDto {
  @IsUUID()
  id: string;
}
