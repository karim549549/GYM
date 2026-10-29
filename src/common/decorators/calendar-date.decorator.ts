import { applyDecorators } from '@nestjs/common';
import { IsISO8601, Length } from 'class-validator';

/** A calendar day as `YYYY-MM-DD`: a real date, with no time and no zone. */
export const CalendarDate = () =>
  applyDecorators(IsISO8601({ strict: true }), Length(10, 10));
