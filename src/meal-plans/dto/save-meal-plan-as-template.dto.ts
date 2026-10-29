import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';

export class SaveMealPlanAsTemplateDto {
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}
