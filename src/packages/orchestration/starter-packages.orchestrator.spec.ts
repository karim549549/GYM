import type { TransactionManager } from '../../database/transaction.manager';
import type { PackagesQueryHandler } from '../handlers/packages-query.handler';
import { StarterPackagesPolicy } from '../policies/starter-packages.policy';
import { StarterPackagesOrchestrator } from './starter-packages.orchestrator';

function setup() {
  const packagesQuery = { createMany: jest.fn().mockResolvedValue(undefined) };
  const transactions = {
    run: jest.fn(async (work: () => Promise<unknown>) => work()),
  };
  const orchestrator = new StarterPackagesOrchestrator(
    packagesQuery as unknown as PackagesQueryHandler,
    new StarterPackagesPolicy(),
    transactions as unknown as TransactionManager,
  );
  return { packagesQuery, transactions, orchestrator };
}

describe('StarterPackagesOrchestrator', () => {
  it('gives the workspace the packages the policy starts a coach with', async () => {
    const { packagesQuery, orchestrator } = setup();

    await orchestrator.execute('workspace-1', 'EGP');

    expect(packagesQuery.createMany).toHaveBeenCalledWith(
      'workspace-1',
      new StarterPackagesPolicy().starterPackages(),
      'EGP',
    );
  });

  it('prices them in the currency it is told the workspace uses', async () => {
    const { packagesQuery, orchestrator } = setup();

    await orchestrator.execute('workspace-1', 'USD');

    expect(packagesQuery.createMany.mock.calls[0][2]).toBe('USD');
  });

  it('joins the transaction that created the workspace, whose scope the database already set', async () => {
    const { transactions, orchestrator } = setup();

    await orchestrator.execute('workspace-1', 'EGP');

    // no scope of its own: asking for one would be refused inside that transaction
    expect(transactions.run).toHaveBeenCalledTimes(1);
    expect(transactions.run.mock.calls[0]).toHaveLength(1);
  });

  it('lets a failure reach the caller', async () => {
    const { packagesQuery, orchestrator } = setup();
    packagesQuery.createMany.mockRejectedValue(new Error('database down'));

    await expect(orchestrator.execute('workspace-1', 'EGP')).rejects.toThrow(
      'database down',
    );
  });
});
