import { Logger } from '@nestjs/common';
import type { TransactionManager } from '../../database/transaction.manager';
import { InvalidImageException } from '../../storage/exceptions/storage-exceptions';
import { WorkspaceNotFoundException } from '../exceptions/workspace-exceptions';
import type { WorkspaceFileHandler } from '../handlers/workspace-file.handler';
import type { WorkspacesQueryHandler } from '../handlers/workspaces-query.handler';
import { WorkspaceLogoOrchestrator } from './workspace-logo.orchestrator';

const bytes = Buffer.from('image bytes');

function setup(existingLogoKey: string | null = 'workspaces/w1/logo-old.webp') {
  const order: string[] = [];
  const workspacesQuery = {
    findById: jest
      .fn()
      .mockResolvedValue({ id: 'w1', logoKey: existingLogoKey }),
    setLogoKey: jest.fn(async () => {
      order.push('record');
    }),
  };
  const files = {
    saveLogo: jest.fn(async () => {
      order.push('upload');
      return 'workspaces/w1/logo-new.webp';
    }),
    removeLogo: jest.fn(async (key: string) => {
      order.push(`remove ${key.split('/').pop()}`);
    }),
    logoUrlOf: jest.fn((key: string) => `https://files.example/${key}`),
  };
  const transactions = {
    run: jest.fn(async (work: () => Promise<unknown>) => {
      const result = await work();
      order.push('commit');
      return result;
    }),
  };
  const orchestrator = new WorkspaceLogoOrchestrator(
    workspacesQuery as unknown as WorkspacesQueryHandler,
    files as unknown as WorkspaceFileHandler,
    transactions as unknown as TransactionManager,
  );
  return { workspacesQuery, files, transactions, orchestrator, order };
}

describe('WorkspaceLogoOrchestrator', () => {
  beforeAll(() => Logger.overrideLogger(false));

  it('stores the new logo, records its key, and returns where to see it', async () => {
    const { workspacesQuery, files, orchestrator } = setup();

    await expect(orchestrator.execute('w1', bytes)).resolves.toEqual({
      logoUrl: 'https://files.example/workspaces/w1/logo-new.webp',
    });
    expect(files.saveLogo).toHaveBeenCalledWith('w1', bytes);
    expect(workspacesQuery.setLogoKey).toHaveBeenCalledWith(
      'w1',
      'workspaces/w1/logo-new.webp',
    );
  });

  it('works inside the workspace’s own scope', async () => {
    const { transactions, orchestrator } = setup();

    await orchestrator.execute('w1', bytes);

    expect(transactions.run).toHaveBeenCalledWith(expect.any(Function), {
      workspaceId: 'w1',
    });
  });

  it('deletes the old logo only after the change is saved for good', async () => {
    const { orchestrator, order } = setup();

    await orchestrator.execute('w1', bytes);

    expect(order).toEqual([
      'upload',
      'record',
      'commit',
      'remove logo-old.webp',
    ]);
  });

  it('has nothing to delete the first time', async () => {
    const { files, orchestrator } = setup(null);

    await orchestrator.execute('w1', bytes);

    expect(files.removeLogo).not.toHaveBeenCalled();
  });

  it('does not fail the request when the old logo cannot be deleted', async () => {
    const { files, orchestrator } = setup();
    files.removeLogo.mockRejectedValue(new Error('storage down'));

    await expect(orchestrator.execute('w1', bytes)).resolves.toEqual({
      logoUrl: expect.any(String),
    });
  });

  it('takes back the upload when the key cannot be recorded, and leaves the old logo alone', async () => {
    const { workspacesQuery, files, orchestrator } = setup();
    workspacesQuery.setLogoKey.mockRejectedValue(new Error('database down'));

    await expect(orchestrator.execute('w1', bytes)).rejects.toThrow(
      'database down',
    );

    expect(files.removeLogo).toHaveBeenCalledTimes(1);
    expect(files.removeLogo).toHaveBeenCalledWith(
      'workspaces/w1/logo-new.webp',
    );
  });

  it('still reports the original failure when taking back the upload also fails', async () => {
    const { workspacesQuery, files, orchestrator } = setup();
    workspacesQuery.setLogoKey.mockRejectedValue(new Error('database down'));
    files.removeLogo.mockRejectedValue(new Error('storage down'));

    await expect(orchestrator.execute('w1', bytes)).rejects.toThrow(
      'database down',
    );
  });

  it('records nothing when the file is not an image', async () => {
    const { workspacesQuery, files, orchestrator } = setup();
    files.saveLogo.mockRejectedValue(new InvalidImageException());

    await expect(orchestrator.execute('w1', bytes)).rejects.toBeInstanceOf(
      InvalidImageException,
    );
    expect(workspacesQuery.setLogoKey).not.toHaveBeenCalled();
    expect(files.removeLogo).not.toHaveBeenCalled();
  });

  it('uploads nothing for a workspace that does not exist', async () => {
    const { workspacesQuery, files, orchestrator } = setup();
    workspacesQuery.findById.mockResolvedValue(null);

    await expect(orchestrator.execute('w1', bytes)).rejects.toBeInstanceOf(
      WorkspaceNotFoundException,
    );
    expect(files.saveLogo).not.toHaveBeenCalled();
  });
});
