import type { TransactionManager } from '../../database/transaction.manager';
import { PackageNotFoundException } from '../exceptions/package-exceptions';
import type { PackagesQueryHandler } from '../handlers/packages-query.handler';
import { PackageUpdateOrchestrator } from './package-update.orchestrator';

const record = {
  id: 'package-1',
  name: 'Monthly',
  durationDays: 30,
  priceMinor: 150_000,
  currency: 'EGP',
  isActive: true,
};

function setup() {
  const packagesQuery = {
    update: jest.fn().mockResolvedValue(record),
    findById: jest.fn().mockResolvedValue(record),
  };
  const transactions = {
    run: jest.fn(async (work: () => Promise<unknown>) => work()),
  };
  const orchestrator = new PackageUpdateOrchestrator(
    packagesQuery as unknown as PackagesQueryHandler,
    transactions as unknown as TransactionManager,
  );
  return { packagesQuery, transactions, orchestrator };
}

describe('PackageUpdateOrchestrator', () => {
  it('changes what was sent and returns the package as it now is', async () => {
    const { packagesQuery, orchestrator } = setup();

    await expect(
      orchestrator.execute('workspace-1', 'package-1', { priceMinor: 175_000 }),
    ).resolves.toBe(record);
    expect(packagesQuery.update).toHaveBeenCalledWith('package-1', {
      priceMinor: 175_000,
    });
  });

  it('works inside the workspace’s own scope', async () => {
    const { transactions, orchestrator } = setup();

    await orchestrator.execute('workspace-1', 'package-1', { name: 'New' });

    expect(transactions.run).toHaveBeenCalledWith(expect.any(Function), {
      workspaceId: 'workspace-1',
    });
  });

  it('only reads the package when nothing was sent', async () => {
    const { packagesQuery, orchestrator } = setup();

    await orchestrator.execute('workspace-1', 'package-1', {});

    expect(packagesQuery.update).not.toHaveBeenCalled();
    expect(packagesQuery.findById).toHaveBeenCalledWith('package-1');
  });

  it('counts fields set to undefined as not sent', async () => {
    const { packagesQuery, orchestrator } = setup();

    await orchestrator.execute('workspace-1', 'package-1', {
      name: undefined,
    });

    expect(packagesQuery.update).not.toHaveBeenCalled();
  });

  it.each(['update', 'findById'] as const)(
    'says the package does not exist when %s finds nothing, which is also how another coach’s package looks',
    async (method) => {
      const { packagesQuery, orchestrator } = setup();
      packagesQuery[method].mockResolvedValue(null);

      await expect(
        orchestrator.execute(
          'workspace-1',
          'package-9',
          method === 'update' ? { name: 'New' } : {},
        ),
      ).rejects.toBeInstanceOf(PackageNotFoundException);
    },
  );
});
