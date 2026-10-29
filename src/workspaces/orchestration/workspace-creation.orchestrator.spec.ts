import type { TransactionManager } from '../../database/transaction.manager';
import type { MembersService } from '../../members/members.service';
import { WorkspaceAlreadyExistsException } from '../exceptions/workspace-exceptions';
import type { WorkspacesQueryHandler } from '../handlers/workspaces-query.handler';
import { WorkspaceCreationOrchestrator } from './workspace-creation.orchestrator';

const slugTaken = () =>
  Object.assign(new Error('failed'), {
    cause: { code: '23505', constraint: 'workspaces_slug_unique' },
  });

function setup() {
  const workspacesQuery = {
    create: jest.fn(async (values: { brandName: string; slug: string }) => ({
      id: 'generated-by-the-database',
      slug: values.slug,
      currency: 'EGP',
    })),
  };
  const members = { addOwner: jest.fn().mockResolvedValue(undefined) };
  const transactions = {
    run: jest.fn(async (work: () => Promise<unknown>) => work()),
    attempt: jest.fn(async (work: () => Promise<unknown>) => work()),
  };
  const orchestrator = new WorkspaceCreationOrchestrator(
    workspacesQuery as unknown as WorkspacesQueryHandler,
    members as unknown as MembersService,
    transactions as unknown as TransactionManager,
  );
  const slugsTried = () =>
    workspacesQuery.create.mock.calls.map(([values]) => values.slug);
  const firstSlug = async (brandName: string) => {
    await orchestrator.execute({ ownerId: 'owner-1', brandName });
    return slugsTried()[0];
  };
  return {
    workspacesQuery,
    members,
    transactions,
    orchestrator,
    slugsTried,
    firstSlug,
  };
}

describe('WorkspaceCreationOrchestrator', () => {
  it('creates the workspace and returns the id the database chose with its handle', async () => {
    const { workspacesQuery, orchestrator } = setup();

    const created = await orchestrator.execute({
      ownerId: 'owner-1',
      brandName: 'Sara Fit',
    });

    expect(created).toEqual({
      id: 'generated-by-the-database',
      slug: 'sara-fit',
      brandName: 'Sara Fit',
      currency: 'EGP',
    });
    expect(workspacesQuery.create).toHaveBeenCalledWith({
      brandName: 'Sara Fit',
      slug: 'sara-fit',
    });
  });

  it('never invents an id itself', async () => {
    const { workspacesQuery, orchestrator } = setup();

    await orchestrator.execute({ ownerId: 'owner-1', brandName: 'Sara Fit' });

    expect(Object.keys(workspacesQuery.create.mock.calls[0][0])).toEqual([
      'brandName',
      'slug',
    ]);
  });

  describe('the owner', () => {
    it('makes the person who asked the owner of the new workspace', async () => {
      const { members, orchestrator } = setup();

      await orchestrator.execute({ ownerId: 'owner-1', brandName: 'Sara Fit' });

      expect(members.addOwner).toHaveBeenCalledWith(
        'generated-by-the-database',
        'owner-1',
      );
    });

    it('creates the workspace and its owner together or not at all', async () => {
      const { transactions, orchestrator } = setup();

      await orchestrator.execute({ ownerId: 'owner-1', brandName: 'Sara Fit' });

      expect(transactions.run).toHaveBeenCalledTimes(1);
    });

    it('adds the owner only after the workspace exists', async () => {
      const { workspacesQuery, members, orchestrator } = setup();
      const order: string[] = [];
      workspacesQuery.create.mockImplementation(async (values) => {
        order.push('workspace');
        return { id: 'w1', slug: values.slug, currency: 'EGP' };
      });
      members.addOwner.mockImplementation(async () => {
        order.push('owner');
      });

      await orchestrator.execute({ ownerId: 'owner-1', brandName: 'Sara Fit' });

      expect(order).toEqual(['workspace', 'owner']);
    });

    it('says so when that person already owns a workspace', async () => {
      const { members, orchestrator } = setup();
      members.addOwner.mockRejectedValue(
        Object.assign(new Error('failed'), {
          cause: {
            code: '23505',
            constraint: 'workspace_members_one_owned_workspace_idx',
          },
        }),
      );

      await expect(
        orchestrator.execute({ ownerId: 'owner-1', brandName: 'Sara Fit' }),
      ).rejects.toBeInstanceOf(WorkspaceAlreadyExistsException);
    });

    it('lets any other failure of adding the owner reach the caller', async () => {
      const { members, orchestrator } = setup();
      members.addOwner.mockRejectedValue(new Error('database down'));

      await expect(
        orchestrator.execute({ ownerId: 'owner-1', brandName: 'Sara Fit' }),
      ).rejects.toThrow('database down');
    });

    it('does not mistake another unique violation for an owner already having one', async () => {
      const { members, orchestrator } = setup();
      members.addOwner.mockRejectedValue(
        Object.assign(new Error('failed'), {
          cause: {
            code: '23505',
            constraint: 'workspace_members_workspace_person_key',
          },
        }),
      );

      await expect(
        orchestrator.execute({ ownerId: 'owner-1', brandName: 'Sara Fit' }),
      ).rejects.not.toBeInstanceOf(WorkspaceAlreadyExistsException);
    });
  });

  describe('the handle', () => {
    it.each([
      ['Ahmed Fitness', 'ahmed-fitness'],
      ["  Coach  Sara's -- Gym!! ", 'coach-sara-s-gym'],
      ['Café Résumé', 'cafe-resume'],
      ['أحمد للياقة', 'coach'],
      ['كابتن Ahmed', 'ahmed'],
    ])('turns "%s" into "%s"', async (brandName, expected) => {
      const { firstSlug } = setup();

      expect(await firstSlug(brandName)).toBe(expected);
    });

    it('keeps a very long name within a safe subdomain length', async () => {
      const { firstSlug } = setup();

      const slug = await firstSlug('a'.repeat(200));

      expect(slug.length).toBeLessThanOrEqual(35);
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    });

    it('tries each candidate as its own savepoint, not as the whole transaction', async () => {
      const { transactions, orchestrator } = setup();

      await orchestrator.execute({ ownerId: 'owner-1', brandName: 'Ahmed' });

      expect(transactions.attempt).toHaveBeenCalledTimes(1);
    });

    it('retries with a short random suffix when the clean handle is taken', async () => {
      const { workspacesQuery, transactions, orchestrator, slugsTried } =
        setup();
      workspacesQuery.create.mockRejectedValueOnce(slugTaken());

      const created = await orchestrator.execute({
        ownerId: 'owner-1',
        brandName: 'Ahmed',
      });

      expect(transactions.attempt).toHaveBeenCalledTimes(2);
      expect(slugsTried()[0]).toBe('ahmed');
      expect(created.slug).toMatch(/^ahmed-[a-z0-9]{4}$/);
    });

    it('gives up after the clean handle and three suffixed ones are all taken', async () => {
      const { workspacesQuery, transactions, orchestrator } = setup();
      workspacesQuery.create.mockRejectedValue(slugTaken());

      await expect(
        orchestrator.execute({ ownerId: 'owner-1', brandName: 'Ahmed' }),
      ).rejects.toMatchObject({
        cause: { constraint: 'workspaces_slug_unique' },
      });

      expect(transactions.attempt).toHaveBeenCalledTimes(4);
    });

    it('does not retry on a failure that is not about the handle', async () => {
      const { workspacesQuery, transactions, orchestrator } = setup();
      workspacesQuery.create.mockRejectedValue(new Error('disk full'));

      await expect(
        orchestrator.execute({ ownerId: 'owner-1', brandName: 'Ahmed' }),
      ).rejects.toThrow('disk full');

      expect(transactions.attempt).toHaveBeenCalledTimes(1);
    });
  });
});
