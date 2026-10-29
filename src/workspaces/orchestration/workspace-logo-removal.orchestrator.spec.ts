import { Logger } from '@nestjs/common';
import type { TransactionManager } from '../../database/transaction.manager';
import { WorkspaceNotFoundException } from '../exceptions/workspace-exceptions';
import type { WorkspaceFileHandler } from '../handlers/workspace-file.handler';
import type { WorkspacesQueryHandler } from '../handlers/workspaces-query.handler';
import { WorkspaceLogoRemovalOrchestrator } from './workspace-logo-removal.orchestrator';

function setup(logoKey: string | null = 'workspaces/w1/logo-old.webp') {
  const order: string[] = [];
  const workspacesQuery = {
    findById: jest.fn().mockResolvedValue({ id: 'w1', logoKey }),
    setLogoKey: jest.fn(async () => {
      order.push('clear');
    }),
  };
  const files = {
    removeLogo: jest.fn(async () => {
      order.push('remove');
    }),
  };
  const transactions = {
    run: jest.fn(async (work: () => Promise<unknown>) => {
      const result = await work();
      order.push('commit');
      return result;
    }),
  };
  const orchestrator = new WorkspaceLogoRemovalOrchestrator(
    workspacesQuery as unknown as WorkspacesQueryHandler,
    files as unknown as WorkspaceFileHandler,
    transactions as unknown as TransactionManager,
  );
  return { workspacesQuery, files, transactions, orchestrator, order };
}

describe('WorkspaceLogoRemovalOrchestrator', () => {
  beforeAll(() => Logger.overrideLogger(false));

  it('clears the key, and deletes the file only after that is saved for good', async () => {
    const { workspacesQuery, files, orchestrator, order } = setup();

    await orchestrator.execute('w1');

    expect(workspacesQuery.setLogoKey).toHaveBeenCalledWith('w1', null);
    expect(files.removeLogo).toHaveBeenCalledWith(
      'workspaces/w1/logo-old.webp',
    );
    expect(order).toEqual(['clear', 'commit', 'remove']);
  });

  it('works inside the workspace’s own scope', async () => {
    const { transactions, orchestrator } = setup();

    await orchestrator.execute('w1');

    expect(transactions.run).toHaveBeenCalledWith(expect.any(Function), {
      workspaceId: 'w1',
    });
  });

  it('does nothing when there is no logo, rather than failing', async () => {
    const { workspacesQuery, files, orchestrator } = setup(null);

    await expect(orchestrator.execute('w1')).resolves.toBeUndefined();
    expect(workspacesQuery.setLogoKey).not.toHaveBeenCalled();
    expect(files.removeLogo).not.toHaveBeenCalled();
  });

  it('does not fail the request when the file cannot be deleted', async () => {
    const { files, orchestrator } = setup();
    files.removeLogo.mockRejectedValue(new Error('storage down'));

    await expect(orchestrator.execute('w1')).resolves.toBeUndefined();
  });

  it('says the workspace does not exist when it is not visible', async () => {
    const { workspacesQuery, orchestrator } = setup();
    workspacesQuery.findById.mockResolvedValue(null);

    await expect(orchestrator.execute('w1')).rejects.toBeInstanceOf(
      WorkspaceNotFoundException,
    );
  });
});
