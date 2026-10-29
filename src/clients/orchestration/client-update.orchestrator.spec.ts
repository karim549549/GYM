import type { TransactionManager } from '../../database/transaction.manager';
import type { PeopleService } from '../../people/people.service';
import { IntakeStatus } from '../enums/intake-status.enum';
import {
  ClientAlreadyExistsException,
  ClientNotFoundException,
} from '../exceptions/client-exceptions';
import type { ClientsQueryHandler } from '../handlers/clients-query.handler';
import { ClientUpdateOrchestrator } from './client-update.orchestrator';

const record = {
  id: 'client-1',
  fullName: 'Omar Khaled',
  phone: '+201012345678',
  intakeStatus: IntakeStatus.PENDING,
  personId: null,
  createdAt: new Date('2026-10-26T10:00:00Z'),
};

function setup() {
  const clientsQuery = {
    update: jest.fn().mockResolvedValue(record),
    findById: jest.fn().mockResolvedValue(record),
  };
  const people = { findByPhone: jest.fn().mockResolvedValue(null) };
  const transactions = {
    run: jest.fn(async (work: () => Promise<unknown>) => work()),
  };
  const orchestrator = new ClientUpdateOrchestrator(
    clientsQuery as unknown as ClientsQueryHandler,
    people as unknown as PeopleService,
    transactions as unknown as TransactionManager,
  );
  return { clientsQuery, people, transactions, orchestrator };
}

describe('ClientUpdateOrchestrator', () => {
  it('changes the name and returns the client as it now is', async () => {
    const { clientsQuery, people, orchestrator } = setup();

    await expect(
      orchestrator.execute('w1', 'client-1', { fullName: 'Omar K.' }),
    ).resolves.toBe(record);
    expect(clientsQuery.update).toHaveBeenCalledWith('client-1', {
      fullName: 'Omar K.',
    });
    expect(people.findByPhone).not.toHaveBeenCalled();
  });

  it('works inside the workspace’s own scope', async () => {
    const { transactions, orchestrator } = setup();

    await orchestrator.execute('w1', 'client-1', { fullName: 'x' });

    expect(transactions.run).toHaveBeenCalledWith(expect.any(Function), {
      workspaceId: 'w1',
    });
  });

  it('looks for the person again when the number changes, since the link follows the number', async () => {
    const { clientsQuery, people, orchestrator } = setup();
    people.findByPhone.mockResolvedValue({ id: 'person-9', fullName: 'New' });

    await orchestrator.execute('w1', 'client-1', { phone: '+201099999999' });

    expect(people.findByPhone).toHaveBeenCalledWith('+201099999999');
    expect(clientsQuery.update).toHaveBeenCalledWith('client-1', {
      phone: '+201099999999',
      personId: 'person-9',
    });
  });

  it('unlinks the client when the new number belongs to nobody', async () => {
    const { clientsQuery, orchestrator } = setup();

    await orchestrator.execute('w1', 'client-1', { phone: '+201099999999' });

    expect(clientsQuery.update).toHaveBeenCalledWith('client-1', {
      phone: '+201099999999',
      personId: null,
    });
  });

  it('only reads the client when nothing was sent', async () => {
    const { clientsQuery, orchestrator } = setup();

    await orchestrator.execute('w1', 'client-1', {});

    expect(clientsQuery.update).not.toHaveBeenCalled();
    expect(clientsQuery.findById).toHaveBeenCalledWith('client-1');
  });

  it('refuses a number another client of this workspace already has', async () => {
    const { clientsQuery, orchestrator } = setup();
    clientsQuery.update.mockRejectedValue(
      Object.assign(new Error('failed'), {
        cause: { code: '23505', constraint: 'clients_workspace_phone_key' },
      }),
    );

    await expect(
      orchestrator.execute('w1', 'client-1', { phone: '+201099999999' }),
    ).rejects.toBeInstanceOf(ClientAlreadyExistsException);
  });

  it.each(['update', 'findById'] as const)(
    'says the client does not exist when %s finds nothing, which is also how another coach’s client looks',
    async (method) => {
      const { clientsQuery, orchestrator } = setup();
      clientsQuery[method].mockResolvedValue(null);

      await expect(
        orchestrator.execute(
          'w1',
          'client-9',
          method === 'update' ? { fullName: 'x' } : {},
        ),
      ).rejects.toBeInstanceOf(ClientNotFoundException);
    },
  );
});
