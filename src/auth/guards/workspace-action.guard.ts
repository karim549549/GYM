import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_ACTION_KEY } from '../../common/decorators/require-action.decorator';
import type { WorkspaceAction } from '../../members/enums/workspace-action.enum';
import { ActionNotAllowedException } from '../../members/exceptions/member-exceptions';
import { MembersService } from '../../members/members.service';
import type { Principal } from '../interfaces/principal.interface';

/**
 * Asks whether the caller's role in the workspace they are acting in allows what the route does.
 * It runs after `AuthGuard`, which has already proved who they are and chosen the workspace. A route
 * with no `@RequireAction` is not about a workspace (signing in, a person's own consents) and is
 * left alone; a person who is acting in no workspace is left to the route, which says so.
 */
@Injectable()
export class WorkspaceActionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly members: MembersService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const action = this.reflector.getAllAndOverride<WorkspaceAction>(
      REQUIRED_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!action) {
      return true;
    }

    const { principal } = context
      .switchToHttp()
      .getRequest<{ principal?: Principal }>();
    if (!principal?.workspaceId) {
      return true;
    }
    if (!this.members.can(principal, action)) {
      throw new ActionNotAllowedException(action);
    }
    return true;
  }
}
