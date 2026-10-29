import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { PlanDayDto } from './plan-structure.dto';

export class ReplacePlanDaysDto {
  /** The whole plan: whatever is not listed is removed. At most 52 weeks of 7 days. */
  @IsArray()
  @ArrayMaxSize(364)
  @ValidateNested({ each: true })
  @Type(() => PlanDayDto)
  days: PlanDayDto[];
}
