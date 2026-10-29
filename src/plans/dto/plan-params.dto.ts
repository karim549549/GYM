import { IsUUID } from 'class-validator';

export class PlanParamsDto {
  @IsUUID()
  id: string;
}
