import { IsUUID } from 'class-validator';

export class ClientParamsDto {
  @IsUUID()
  id: string;
}
