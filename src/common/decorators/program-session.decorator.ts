import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * The session a client's device sends with its program link, from the `x-program-session` header. Its
 * signature is checked where it is used; here it is only read, and is undefined when the header is missing.
 */
export const ProgramSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const header = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>()
      .headers['x-program-session'];
    return typeof header === 'string' ? header : undefined;
  },
);
