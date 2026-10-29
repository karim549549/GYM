import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { QuestionType } from '../../intake/enums/question-type.enum';

export class FormChoiceDto {
  /** What is kept in the answer: short, and different from the other options'. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  value: string;

  /** What the person reads. */
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  labelAr: string;
}

export class FormQuestionDto {
  /** The question, in Arabic. */
  @IsString()
  @MaxLength(400)
  labelAr: string;

  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  labelEn?: string;

  /** A line of help under the question. */
  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  helpText?: string;

  @IsEnum(QuestionType)
  inputType: QuestionType;

  /** For the select types: two to thirty. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => FormChoiceDto)
  options?: FormChoiceDto[];

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  /** Shown beside a number, such as kg. */
  @Trimmed()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  /** A number tagged `weight`, `waist` and so on is also saved as a measurement, so the charts keep working. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  mapsToMetric?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-1_000_000)
  @Max(1_000_000)
  min?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-1_000_000)
  @Max(1_000_000)
  max?: number;

  @IsOptional()
  @IsBoolean()
  integer?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  maxLength?: number;
}
