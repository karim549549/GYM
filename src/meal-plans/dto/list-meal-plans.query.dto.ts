import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { MealPlanStatus } from '../enums/meal-plan-status.enum';

export class ListMealPlansQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  /** Query strings are text, so this is 'true' or 'false': templates only, or client plans only. */
  @IsOptional()
  @IsIn(['true', 'false'])
  template?: 'true' | 'false';

  @IsOptional()
  @IsEnum(MealPlanStatus)
  status?: MealPlanStatus;
}
