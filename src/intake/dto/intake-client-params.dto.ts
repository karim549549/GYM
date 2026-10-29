import { IsUUID } from 'class-validator';

export class IntakeClientParamsDto {
  @IsUUID()
  id: string;
}
