import { IsUUID } from 'class-validator';

export class FoodParamsDto {
  @IsUUID()
  id: string;
}
