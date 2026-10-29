import { IsEnum, IsUUID } from 'class-validator';
import { FormPurpose } from '../enums/form-purpose.enum';

export class FormPurposeParamsDto {
  @IsEnum(FormPurpose)
  purpose: FormPurpose;
}

export class FormTemplateParamsDto {
  @IsUUID()
  id: string;
}
