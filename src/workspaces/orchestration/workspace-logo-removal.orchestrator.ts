import { Injectable, Logger } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { WorkspaceNotFoundException } from '../exceptions/workspace-exceptions';
import { WorkspaceFileHandler } from '../handlers/workspace-file.handler';
import { WorkspacesQueryHandler } from '../handlers/workspaces-query.handler';

/** Takes over `WorkspacesService.removeLogo`: clear the key, then delete the file once that is saved. */
@Injectable()
export class WorkspaceLogoRemovalOrchestrator {
  private readonly logger = new Logger(WorkspaceLogoRemovalOrchestrator.name);

  constructor(
    private readonly workspacesQuery: WorkspacesQueryHandler,
    private readonly files: WorkspaceFileHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(workspaceId: string): Promise<void> {
    const removedKey = await this.transactions.run(
      async () => {
        const workspace = await this.workspacesQuery.findById(workspaceId);
        if (!workspace) {
          throw new WorkspaceNotFoundException();
        }
        if (!workspace.logoKey) {
          return null;
        }
        await this.workspacesQuery.setLogoKey(workspaceId, null);
        return workspace.logoKey;
      },
      { workspaceId },
    );

    if (removedKey) {
      try {
        await this.files.removeLogo(removedKey);
      } catch {
        this.logger.warn(`Could not delete the file ${removedKey}`);
      }
    }
  }
}
