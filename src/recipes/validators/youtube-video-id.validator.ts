import {
  isAlphanumeric,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
@ValidatorConstraint({ name: 'youtubeVideoId', async: false })
export class YoutubeVideoIdValidator implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      typeof value === 'string' &&
      value.length === 11 &&
      isAlphanumeric('a' + value.split('-').join('').split('_').join(''))
    );
  }
  defaultMessage(): string {
    return 'youtubeVideoId must be an 11-character YouTube video id';
  }
}
