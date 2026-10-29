import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** The bearer token the guard already verified, for the one route that must hand it back to the identity provider. */
export const CurrentAccessToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string =>
    context.switchToHttp().getRequest<{ accessToken: string }>().accessToken,
);
