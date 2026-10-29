import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** What a hook call said, once its signature has been verified. */
export const CurrentHookPayload = createParamDecorator(
  (_data: unknown, context: ExecutionContext): unknown =>
    context.switchToHttp().getRequest<{ hookPayload: unknown }>().hookPayload,
);
