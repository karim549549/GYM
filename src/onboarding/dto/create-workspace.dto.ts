import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';

export class CreateWorkspaceDto {
  /** What clients see. When left out, the coach's own name is used. */
  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  brandName?: string;
}
