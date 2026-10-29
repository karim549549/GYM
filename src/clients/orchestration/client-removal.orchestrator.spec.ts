import type { TransactionManager } from '../../database/transaction.manager';
import { ClientNotFoundException } from '../exceptions/client-exceptions';
import type { ClientsQueryHandler } from '../handlers/clients-query.handler';
import { ClientRemovalOrchestrator } from './client-removal.orchestrator';

function setup(removed = true) {
  const clientsQuery = { remove: jest.fn().mockResolvedValue(removed) };
  const transactions = {
    run: jest.fn(async (work: () => Promise<unknown>) => work()),
  };
  const orchestrator = new ClientRemovalOrchestrator(
    clientsQuery as unknown as ClientsQueryHandler,
    transactions as unknown as TransactionManager,
  );
  return { clientsQuery, transactions, orchestrator };
}

describe('ClientRemovalOrchestrator', () => {
  it('removes the client from the workspace', async () => {
    const { clientsQuery, orchestrator } = setup();

    await expect(
      orchestrator.execute('w1', 'client-1'),
    ).resolves.toBeUndefined();
    expect(clientsQuery.remove).toHaveBeenCalledWith('client-1');
  });

  it('works inside the workspace’s own scope', async () => {
    const { transactions, orchestrator } = setup();

    await orchestrator.execute('w1', 'client-1');

    expect(transactions.run).toHaveBeenCalledWith(expect.any(Function), {
      workspaceId: 'w1',
    });
  });

  it('says the client does not exist when there was nothing to remove', async () => {
    const { orchestrator } = setup(false);

    await expect(orchestrator.execute('w1', 'client-9')).rejects.toBeInstanceOf(
      ClientNotFoundException,
    );
  });
});
