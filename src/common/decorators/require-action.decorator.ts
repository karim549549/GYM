import { SetMetadata } from '@nestjs/common';
import type { WorkspaceAction } from '../../members/enums/workspace-action.enum';

export const REQUIRED_ACTION_KEY = 'requiredWorkspaceAction';

/**
 * Names what a route does inside a workspace, so `WorkspaceActionGuard` can ask whether the caller's
 * role allows it. A route that works on a workspace's data must carry one; a test fails for one that does not.
 */
export const RequireAction = (action: WorkspaceAction) =>
  SetMetadata(REQUIRED_ACTION_KEY, action);
