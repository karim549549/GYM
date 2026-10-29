import type { TransactionManager } from '../../database/transaction.manager';
import { IntakeStatus } from '../enums/intake-status.enum';
import { ClientNotFoundException } from '../exceptions/client-exceptions';
import type { ClientsQueryHandler } from '../handlers/clients-query.handler';
import { ClientIntakeStatusOrchestrator } from './client-intake-status.orchestrator';

function setup(found = true) {
  const clientsQuery = { setIntakeStatus: jest.fn().mockResolvedValue(found) };
  const transactions = {
    run: jest.fn(async (work: () => Promise<unknown>) => work()),
  };
  const orchestrator = new ClientIntakeStatusOrchestrator(
    clientsQuery as unknown as ClientsQueryHandler,
    transactions as unknown as TransactionManager,
  );
  return { clientsQuery, transactions, orchestrator };
}

describe('ClientIntakeStatusOrchestrator', () => {
  it('sets how far along the client is', async () => {
    const { clientsQuery, orchestrator } = setup();

    await expect(
      orchestrator.execute('w1', 'c1', IntakeStatus.SUBMITTED),
    ).resolves.toBeUndefined();
    expect(clientsQuery.setIntakeStatus).toHaveBeenCalledWith(
      'c1',
      IntakeStatus.SUBMITTED,
    );
  });

  it('joins the transaction it is called in, inside the workspace’s scope', async () => {
    const { transactions, orchestrator } = setup();

    await orchestrator.execute('w1', 'c1', IntakeStatus.SUBMITTED);

    expect(transactions.run).toHaveBeenCalledWith(expect.any(Function), {
      workspaceId: 'w1',
    });
  });

  it('says the client does not exist when there is nobody to update', async () => {
    const { orchestrator } = setup(false);

    await expect(
      orchestrator.execute('w1', 'c9', IntakeStatus.SUBMITTED),
    ).rejects.toBeInstanceOf(ClientNotFoundException);
  });
});
