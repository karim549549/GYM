import type { ConfigService } from '@nestjs/config';
import type { ClientsService } from '../../clients/clients.service';
import type { Env } from '../../config/env.schema';
import type { TransactionManager } from '../../database/transaction.manager';
import type { FormsService } from '../../forms/forms.service';
import type { WorkspacesService } from '../../workspaces/workspaces.service';
import type { IntakeQueryHandler } from '../handlers/intake-query.handler';
import { IntakeLinkCreationOrchestrator } from './intake-link-creation.orchestrator';

function setup() {
  const link = { token: 'existing-token', expiresAt: new Date('2026-12-01') };
  const query = {
    findOpenLinkForClient: jest.fn().mockResolvedValue(null),
    createLink: jest.fn().mockResolvedValue(link),
  };
  const transactions = {
    run: <T>(work: () => Promise<T>) => work(),
    attempt: jest.fn(async (work: () => Promise<unknown>) => work()),
  };
  const orchestrator = new IntakeLinkCreationOrchestrator(
    query as unknown as IntakeQueryHandler,
    {
      findOne: jest.fn().mockResolvedValue({ id: 'client' }),
    } as unknown as ClientsService,
    { get: () => 'https://app.example.com' } as unknown as ConfigService<
      Env,
      true
    >,
    transactions as unknown as TransactionManager,
    {
      namedForm: jest.fn().mockResolvedValue({ purpose: 'intake' }),
    } as unknown as FormsService,
    {
      findCurrent: jest.fn().mockResolvedValue({ slug: 'sara-fit' }),
    } as unknown as WorkspacesService,
  );
  return { orchestrator, query, transactions, link };
}

const tokenCollision = () =>
  Object.assign(new Error('collision'), {
    cause: { code: '23505', constraint: 'intake_links_token_unique' },
  });

describe('IntakeLinkCreationOrchestrator retries', () => {
  it('returns the open link without creating another', async () => {
    const { orchestrator, query, link } = setup();
    query.findOpenLinkForClient.mockResolvedValueOnce(link);
    await expect(
      orchestrator.execute('workspace', 'client'),
    ).resolves.toMatchObject({
      token: link.token,
      url: `https://app.example.com/intake/sara-fit/${link.token}`,
    });
    expect(query.createLink).not.toHaveBeenCalled();
  });

  it('retries a collision in another savepoint and returns the successful link', async () => {
    const { orchestrator, query, transactions, link } = setup();
    query.createLink.mockRejectedValueOnce(tokenCollision());
    await expect(
      orchestrator.execute('workspace', 'client'),
    ).resolves.toMatchObject(link);
    expect(query.createLink).toHaveBeenCalledTimes(2);
    expect(transactions.attempt).toHaveBeenCalledTimes(2);
  });

  it('stops after three collisions and propagates the last failure', async () => {
    const { orchestrator, query, transactions } = setup();
    const failure = tokenCollision();
    query.createLink.mockRejectedValue(failure);
    await expect(orchestrator.execute('workspace', 'client')).rejects.toBe(
      failure,
    );
    expect(transactions.attempt).toHaveBeenCalledTimes(3);
  });

  it('does not retry a failure unrelated to a token collision', async () => {
    const { orchestrator, query, transactions } = setup();
    const failure = new Error('database unavailable');
    query.createLink.mockRejectedValue(failure);
    await expect(orchestrator.execute('workspace', 'client')).rejects.toBe(
      failure,
    );
    expect(transactions.attempt).toHaveBeenCalledTimes(1);
  });
});
