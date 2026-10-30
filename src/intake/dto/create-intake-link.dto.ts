import { IsOptional, IsUUID } from 'class-validator';

export class CreateIntakeLinkDto {
  /**
   * One of the coach's named forms for this client; `null` goes back to their default form. Leave it out
   * to keep what an open link already asks (a new link then asks the default form).
   */
  @IsOptional()
  @IsUUID()
  namedFormId?: string | null;
}
