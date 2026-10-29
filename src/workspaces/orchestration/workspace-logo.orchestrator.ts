import { Injectable, Logger } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { WorkspaceNotFoundException } from '../exceptions/workspace-exceptions';
import { WorkspaceFileHandler } from '../handlers/workspace-file.handler';
import { WorkspacesQueryHandler } from '../handlers/workspaces-query.handler';

/**
 * Takes over `WorkspacesService.setLogo`. The new logo is stored and its key recorded in one
 * transaction; the old file is deleted only after that has been saved for good, so a failure
 * never leaves a workspace pointing at a file that is gone. A file that cannot be deleted is
 * logged and left, not allowed to fail the request.
 */
@Injectable()
export class WorkspaceLogoOrchestrator {
  private readonly logger = new Logger(WorkspaceLogoOrchestrator.name);

  constructor(
    private readonly workspacesQuery: WorkspacesQueryHandler,
    private readonly files: WorkspaceFileHandler,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(
    workspaceId: string,
    bytes: Uint8Array,
  ): Promise<{ logoUrl: string }> {
    const { newKey, previousKey } = await this.transactions.run(
      async () => {
        const workspace = await this.workspacesQuery.findById(workspaceId);
        if (!workspace) {
          throw new WorkspaceNotFoundException();
        }

        const newKey = await this.files.saveLogo(workspaceId, bytes);
        try {
          await this.workspacesQuery.setLogoKey(workspaceId, newKey);
        } catch (error) {
          await this.discard(newKey);
          throw error;
        }
        return { newKey, previousKey: workspace.logoKey };
      },
      { workspaceId },
    );

    if (previousKey) {
      await this.discard(previousKey);
    }
    return { logoUrl: this.files.logoUrlOf(newKey) };
  }

  private async discard(key: string): Promise<void> {
    try {
      await this.files.removeLogo(key);
    } catch {
      this.logger.warn(`Could not delete the file ${key}`);
    }
  }
}
