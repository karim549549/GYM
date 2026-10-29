import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { WorkspaceNotFoundException } from '../exceptions/workspace-exceptions';
import { WorkspaceFileHandler } from '../handlers/workspace-file.handler';
import { WorkspacesQueryHandler } from '../handlers/workspaces-query.handler';
import type { WorkspaceDetails } from '../interfaces/workspace.interface';

/** Takes over `WorkspacesService.findCurrent`: the workspace a coach is acting in. */
@Injectable()
export class WorkspaceDetailsOrchestrator {
  constructor(
    private readonly workspacesQuery: WorkspacesQueryHandler,
    private readonly files: WorkspaceFileHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(workspaceId: string): Promise<WorkspaceDetails> {
    const workspace = await this.transactions.run(
      () => this.workspacesQuery.findById(workspaceId),
      { workspaceId },
    );
    if (!workspace) {
      throw new WorkspaceNotFoundException();
    }
    return this.files.withLogoUrl(workspace);
  }
}
