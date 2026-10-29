import type { TransactionManager } from '../../database/transaction.manager';
import { Specialty } from '../enums/specialty.enum';
import { MemberNotFoundException } from '../exceptions/member-exceptions';
import type { MembersQueryHandler } from '../handlers/members-query.handler';
import { MemberProfileUpdateOrchestrator } from './member-profile-update.orchestrator';

const profile = {
  specialties: [Specialty.FAT_LOSS],
  bio: 'Coach',
  instagram: 'sara.fit',
};

function setup() {
  const membersQuery = {
    updateProfile: jest.fn().mockResolvedValue(profile),
    findProfile: jest.fn().mockResolvedValue(profile),
  };
  const transactions = {
    run: jest.fn(async (work: () => Promise<unknown>) => work()),
  };
  const orchestrator = new MemberProfileUpdateOrchestrator(
    membersQuery as unknown as MembersQueryHandler,
    transactions as unknown as TransactionManager,
  );
  return { membersQuery, transactions, orchestrator };
}

describe('MemberProfileUpdateOrchestrator', () => {
  it('changes what was sent and returns the profile as it now is', async () => {
    const { membersQuery, orchestrator } = setup();

    await expect(
      orchestrator.execute('w1', 'p1', { bio: 'New bio' }),
    ).resolves.toBe(profile);
    expect(membersQuery.updateProfile).toHaveBeenCalledWith('w1', 'p1', {
      bio: 'New bio',
    });
  });

  it('works inside the workspace’s own scope', async () => {
    const { transactions, orchestrator } = setup();

    await orchestrator.execute('w1', 'p1', { bio: 'x' });

    expect(transactions.run).toHaveBeenCalledWith(expect.any(Function), {
      workspaceId: 'w1',
    });
  });

  it('only reads the profile when nothing was sent', async () => {
    const { membersQuery, orchestrator } = setup();

    await orchestrator.execute('w1', 'p1', {});

    expect(membersQuery.updateProfile).not.toHaveBeenCalled();
    expect(membersQuery.findProfile).toHaveBeenCalledWith('w1', 'p1');
  });

  it('counts a field set to null as sent, because that clears it', async () => {
    const { membersQuery, orchestrator } = setup();

    await orchestrator.execute('w1', 'p1', { bio: null });

    expect(membersQuery.updateProfile).toHaveBeenCalledWith('w1', 'p1', {
      bio: null,
    });
  });

  it('counts a field left undefined as not sent', async () => {
    const { membersQuery, orchestrator } = setup();

    await orchestrator.execute('w1', 'p1', { bio: undefined });

    expect(membersQuery.updateProfile).not.toHaveBeenCalled();
  });

  it.each(['updateProfile', 'findProfile'] as const)(
    'says the member does not exist when %s finds nothing',
    async (method) => {
      const { membersQuery, orchestrator } = setup();
      membersQuery[method].mockResolvedValue(null);

      await expect(
        orchestrator.execute(
          'w1',
          'p1',
          method === 'updateProfile' ? { bio: 'x' } : {},
        ),
      ).rejects.toBeInstanceOf(MemberNotFoundException);
    },
  );
});
