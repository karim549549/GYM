import type { TransactionManager } from '../../database/transaction.manager';
import type { PeopleService } from '../../people/people.service';
import { IntakeStatus } from '../enums/intake-status.enum';
import { ClientAlreadyExistsException } from '../exceptions/client-exceptions';
import type { ClientsQueryHandler } from '../handlers/clients-query.handler';
import { ClientCreationOrchestrator } from './client-creation.orchestrator';

const record = {
  id: 'client-1',
  fullName: 'Omar Khaled',
  phone: '+201012345678',
  intakeStatus: IntakeStatus.PENDING,
  personId: null,
  createdAt: new Date('2026-10-26T10:00:00Z'),
};
const input = { fullName: 'Omar Khaled', phone: '+201012345678' };

function setup() {
  const clientsQuery = {
    findByPhoneIncludingRemoved: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(record),
    restore: jest.fn().mockResolvedValue(record),
  };
  const people = { findByPhone: jest.fn().mockResolvedValue(null) };
  const transactions = {
    run: jest.fn(async (work: () => Promise<unknown>) => work()),
  };
  const orchestrator = new ClientCreationOrchestrator(
    clientsQuery as unknown as ClientsQueryHandler,
    people as unknown as PeopleService,
    transactions as unknown as TransactionManager,
  );
  return { clientsQuery, people, transactions, orchestrator };
}

describe('ClientCreationOrchestrator', () => {
  it('adds the client to the workspace and returns it', async () => {
    const { clientsQuery, orchestrator } = setup();

    await expect(orchestrator.execute('w1', input)).resolves.toBe(record);
    expect(clientsQuery.create).toHaveBeenCalledWith('w1', input, null);
  });

  it('works inside the workspace’s own scope, in one transaction', async () => {
    const { transactions, orchestrator } = setup();

    await orchestrator.execute('w1', input);

    expect(transactions.run).toHaveBeenCalledTimes(1);
    expect(transactions.run).toHaveBeenCalledWith(expect.any(Function), {
      workspaceId: 'w1',
    });
  });

  it('links the client to the person who already signed up with that number', async () => {
    const { clientsQuery, people, orchestrator } = setup();
    people.findByPhone.mockResolvedValue({ id: 'person-9', fullName: 'Omar' });

    await orchestrator.execute('w1', input);

    expect(people.findByPhone).toHaveBeenCalledWith('+201012345678');
    expect(clientsQuery.create).toHaveBeenCalledWith('w1', input, 'person-9');
  });

  it('refuses a client the workspace already has', async () => {
    const { clientsQuery, orchestrator } = setup();
    clientsQuery.findByPhoneIncludingRemoved.mockResolvedValue({
      id: 'client-1',
      removed: false,
    });

    await expect(orchestrator.execute('w1', input)).rejects.toBeInstanceOf(
      ClientAlreadyExistsException,
    );
    expect(clientsQuery.create).not.toHaveBeenCalled();
    expect(clientsQuery.restore).not.toHaveBeenCalled();
  });

  it('brings back a client who was removed, instead of making a second one', async () => {
    const { clientsQuery, people, orchestrator } = setup();
    clientsQuery.findByPhoneIncludingRemoved.mockResolvedValue({
      id: 'client-1',
      removed: true,
    });
    people.findByPhone.mockResolvedValue({ id: 'person-9', fullName: 'Omar' });

    await expect(orchestrator.execute('w1', input)).resolves.toBe(record);

    expect(clientsQuery.restore).toHaveBeenCalledWith('client-1', {
      fullName: 'Omar Khaled',
      personId: 'person-9',
    });
    expect(clientsQuery.create).not.toHaveBeenCalled();
  });

  it('says the client exists when two requests race and the database refuses the second', async () => {
    const { clientsQuery, orchestrator } = setup();
    clientsQuery.create.mockRejectedValue(
      Object.assign(new Error('failed'), {
        cause: { code: '23505', constraint: 'clients_workspace_phone_key' },
      }),
    );

    await expect(orchestrator.execute('w1', input)).rejects.toBeInstanceOf(
      ClientAlreadyExistsException,
    );
  });

  it('lets any other failure reach the caller', async () => {
    const { clientsQuery, orchestrator } = setup();
    clientsQuery.create.mockRejectedValue(new Error('database down'));

    await expect(orchestrator.execute('w1', input)).rejects.toThrow(
      'database down',
    );
  });
});
