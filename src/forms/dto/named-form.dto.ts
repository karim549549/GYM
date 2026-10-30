import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Trimmed } from '../../common/decorators/trimmed.decorator';
import { FormPurpose } from '../enums/form-purpose.enum';
import { FormQuestionDto } from './form-question.dto';

export class NamedFormParamsDto {
  @IsUUID()
  id: string;
}

export class ListNamedFormsQueryDto {
  @IsOptional()
  @IsEnum(FormPurpose)
  purpose?: FormPurpose;
}

export class CreateNamedFormDto {
  @IsEnum(FormPurpose)
  purpose: FormPurpose;

  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  /** The first version of the form. One to sixty questions. */
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => FormQuestionDto)
  questions: FormQuestionDto[];
}

/** Anything left out stays as it is; sending questions saves a new version. */
export class UpdateNamedFormDto {
  @Trimmed()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => FormQuestionDto)
  questions?: FormQuestionDto[];
}
