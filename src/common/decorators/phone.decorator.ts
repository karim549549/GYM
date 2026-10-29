import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsPhoneNumber } from 'class-validator';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * A phone number typed the Egyptian way (010...) or with its country code, stored and
 * compared everywhere in international form (+20...). Anything that is not a real number
 * is left as typed, so validation reports it.
 */
export const Phone = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string'
        ? (parsePhoneNumberFromString(value.trim(), 'EG')?.number ?? value)
        : value,
    ),
    IsPhoneNumber(),
  );
