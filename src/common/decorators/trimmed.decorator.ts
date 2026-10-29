import { Transform } from 'class-transformer';

/** Strips surrounding whitespace from a string field before it is validated. */
export const Trimmed = (options: { lowercase?: boolean } = {}) =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return options.lowercase ? trimmed.toLowerCase() : trimmed;
  });
