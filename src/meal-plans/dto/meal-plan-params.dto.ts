import { IsUUID } from 'class-validator';

export class MealPlanParamsDto {
  @IsUUID()
  id: string;
}
