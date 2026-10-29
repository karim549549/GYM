import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Principal } from '../../auth/interfaces/principal.interface';
import { NoWorkspaceException } from '../../auth/exceptions/auth-exceptions';

/**
 * The workspace the request acts in, for every endpoint that works on a coach's data.
 * A person who has not created a workspace yet has none, and is told to create one.
 */
export const CurrentWorkspaceId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const { workspaceId } = context
      .switchToHttp()
      .getRequest<{ principal: Principal }>().principal;
    if (!workspaceId) {
      throw new NoWorkspaceException();
    }
    return workspaceId;
  },
);
