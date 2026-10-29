import { Type } from 'class-transformer';
import { IsDefined, IsObject, ValidateNested } from 'class-validator';
import { ClientConsentsDto } from '../../consents/dto/consent.dto';

export class SubmitIntakeDto {
  /** Checked against the form by the intake policy, since the questions are data, not fields of this class. */
  @IsObject()
  answers: Record<string, unknown>;

  /** What the client agrees to; the two that cover their data are required for the form to be taken. */
  @IsDefined()
  @ValidateNested()
  @Type(() => ClientConsentsDto)
  consents: ClientConsentsDto;
}
