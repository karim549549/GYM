import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { WorkspaceNotFoundException } from '../exceptions/workspace-exceptions';
import { WorkspaceFileHandler } from '../handlers/workspace-file.handler';
import { WorkspacesQueryHandler } from '../handlers/workspaces-query.handler';
import type {
  WorkspaceChanges,
  WorkspaceDetails,
} from '../interfaces/workspace.interface';

/** Takes over `WorkspacesService.updateCurrent`: change the settings a coach sent, leave the rest. */
@Injectable()
export class WorkspaceUpdateOrchestrator {
  constructor(
    private readonly workspacesQuery: WorkspacesQueryHandler,
    private readonly files: WorkspaceFileHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(
    workspaceId: string,
    changes: WorkspaceChanges,
  ): Promise<WorkspaceDetails> {
    const workspace = await this.transactions.run(
      () =>
        Object.values(changes).some((value) => value !== undefined)
          ? this.workspacesQuery.update(workspaceId, changes)
          : this.workspacesQuery.findById(workspaceId),
      { workspaceId },
    );
    if (!workspace) {
      throw new WorkspaceNotFoundException();
    }
    return this.files.withLogoUrl(workspace);
  }
}
