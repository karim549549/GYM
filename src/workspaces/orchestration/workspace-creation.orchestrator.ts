import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { MembersService } from '../../members/members.service';
import { WorkspaceAlreadyExistsException } from '../exceptions/workspace-exceptions';
import { WorkspacesQueryHandler } from '../handlers/workspaces-query.handler';
import type {
  CreatedWorkspace,
  NewWorkspace,
} from '../interfaces/workspace.interface';

/**
 * Takes over `WorkspacesService.create`: a workspace with a handle that is free, and the
 * person who asked as its owner, all or nothing. The new workspace puts the transaction in
 * its own scope, so no scope is chosen here.
 */
@Injectable()
export class WorkspaceCreationOrchestrator {
  private static readonly MAX_HANDLE_LENGTH = 40;
  private static readonly SUFFIX_ROOM = 5;
  private static readonly SUFFIXED_FALLBACKS = 3;

  constructor(
    private readonly workspacesQuery: WorkspacesQueryHandler,
    private readonly members: MembersService,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspace: NewWorkspace): Promise<CreatedWorkspace> {
    return this.transactions.run(async () => {
      const created = await this.createWithFreeHandle(workspace.brandName);
      await this.addOwner(created.id, workspace.ownerId);
      return created;
    });
  }

  private async addOwner(workspaceId: string, ownerId: string): Promise<void> {
    try {
      await this.members.addOwner(workspaceId, ownerId);
    } catch (error) {
      // the database allows a person one owned workspace; say it in our words
      throw this.violatesUnique(
        error,
        'workspace_members_one_owned_workspace_idx',
      )
        ? new WorkspaceAlreadyExistsException()
        : error;
    }
  }

  private createWithFreeHandle(brandName: string): Promise<CreatedWorkspace> {
    return this.tryHandle(brandName, this.handleCandidates(brandName));
  }

  private async tryHandle(
    brandName: string,
    handles: string[],
    index = 0,
  ): Promise<CreatedWorkspace> {
    const slug = handles[index];
    try {
      // Each candidate is a savepoint: a collision must not poison the caller's transaction.
      const created = await this.transactions.attempt(() =>
        this.workspacesQuery.create({ brandName, slug }),
      );
      return { ...created, brandName };
    } catch (error) {
      if (
        !this.violatesUnique(error, 'workspaces_slug_unique') ||
        index === handles.length - 1
      ) {
        throw error;
      }
      return this.tryHandle(brandName, handles, index + 1);
    }
  }

  /** The clean handle first, then suffixed variants in case it is taken. */
  private handleCandidates(brandName: string): string[] {
    const base = (this.toHandle(brandName) || 'coach')
      .slice(
        0,
        WorkspaceCreationOrchestrator.MAX_HANDLE_LENGTH -
          WorkspaceCreationOrchestrator.SUFFIX_ROOM,
      )
      .replace(/-+$/, '');

    return [
      base,
      ...Array.from(
        { length: WorkspaceCreationOrchestrator.SUFFIXED_FALLBACKS },
        () => `${base}-${this.randomSuffix()}`,
      ),
    ];
  }

  private toHandle(brandName: string): string {
    return brandName
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private randomSuffix(): string {
    return randomBytes(3).toString('hex').slice(0, 4);
  }

  private violatesUnique(error: unknown, constraintName: string): boolean {
    for (
      let link: unknown = error, depth = 0;
      link && depth < 5;
      link = (link as { cause?: unknown }).cause, depth += 1
    ) {
      const { code, constraint } = link as {
        code?: string;
        constraint?: string;
      };
      if (code === '23505' && constraint === constraintName) {
        return true;
      }
    }
    return false;
  }
}
