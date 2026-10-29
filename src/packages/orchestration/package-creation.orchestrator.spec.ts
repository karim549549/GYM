import type { TransactionManager } from '../../database/transaction.manager';
import type { WorkspacesService } from '../../workspaces/workspaces.service';
import type { PackagesQueryHandler } from '../handlers/packages-query.handler';
import { PackageCreationOrchestrator } from './package-creation.orchestrator';

const record = {
  id: 'package-1',
  name: 'Quarterly',
  durationDays: 90,
  priceMinor: 450_000,
  currency: 'EGP',
  isActive: true,
};

function setup(currency = 'EGP') {
  const packagesQuery = { create: jest.fn().mockResolvedValue(record) };
  const workspaces = { findCurrent: jest.fn().mockResolvedValue({ currency }) };
  const transactions = {
    run: jest.fn(async (work: () => Promise<unknown>) => work()),
  };
  const orchestrator = new PackageCreationOrchestrator(
    packagesQuery as unknown as PackagesQueryHandler,
    workspaces as unknown as WorkspacesService,
    transactions as unknown as TransactionManager,
  );
  return { packagesQuery, workspaces, transactions, orchestrator };
}

describe('PackageCreationOrchestrator', () => {
  const input = { name: 'Quarterly', durationDays: 90, priceMinor: 450_000 };

  it('creates the package in the workspace and returns it', async () => {
    const { packagesQuery, orchestrator } = setup();

    await expect(orchestrator.execute('workspace-1', input)).resolves.toBe(
      record,
    );
    expect(packagesQuery.create).toHaveBeenCalledWith(
      'workspace-1',
      input,
      'EGP',
    );
  });

  it('prices it in the workspace’s currency, not one the caller names', async () => {
    const { packagesQuery, orchestrator } = setup('SAR');

    await orchestrator.execute('workspace-1', input);

    expect(packagesQuery.create.mock.calls[0][2]).toBe('SAR');
  });

  it('reads the currency and writes the package in one transaction scoped to the workspace', async () => {
    const { transactions, orchestrator } = setup();

    await orchestrator.execute('workspace-1', input);

    expect(transactions.run).toHaveBeenCalledTimes(1);
    expect(transactions.run).toHaveBeenCalledWith(expect.any(Function), {
      workspaceId: 'workspace-1',
    });
  });
});
