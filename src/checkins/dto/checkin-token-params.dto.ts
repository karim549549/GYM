import { IsAlphanumeric, Length } from 'class-validator';

/** The secret in a link's address: 8 letters and digits. Anything else cannot be a token. */
export class CheckinTokenParamsDto {
  @IsAlphanumeric()
  @Length(8, 8)
  token: string;
}
