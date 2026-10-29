import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { FormQuestionDto } from './form-question.dto';

export class SaveFormDto {
  /** The whole form: it becomes the next version. One to sixty questions. */
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => FormQuestionDto)
  questions: FormQuestionDto[];
}
