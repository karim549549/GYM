import { IsUUID } from 'class-validator';

export class ProgramClientParamsDto {
  @IsUUID()
  id: string;
}
