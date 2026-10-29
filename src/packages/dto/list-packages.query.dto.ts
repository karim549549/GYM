import { IsIn, IsOptional } from 'class-validator';

export class ListPackagesQueryDto {
  /** Query strings are text, so this is 'true' or 'false'. */
  @IsOptional()
  @IsIn(['true', 'false'])
  includeInactive?: 'true' | 'false';
}
