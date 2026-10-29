import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { Database } from './database.module';
import { TransactionManager } from './transaction.manager';

const dialect = new PgDialect();

function createFakeDatabase() {
  let opened = 0;
  let savepoints = 0;
  const executed: SQL[] = [];
  const db = {
    name: 'base',
    transactionsOpened: () => opened,
    savepointsOpened: () => savepoints,
    executedParams: () =>
      executed.map((query) => dialect.sqlToQuery(query).params),
    transaction: async <T>(work: (tx: unknown) => Promise<T>) => {
      opened += 1;
      const tx = {
        name: `tx-${opened}`,
        execute: async (query: SQL) => {
          executed.push(query);
        },
        // a nested transaction is a savepoint
        transaction: async <R>(nested: (tx: unknown) => Promise<R>) => {
          savepoints += 1;
          return nested(tx);
        },
      };
      return work(tx);
    },
  };
  return db;
}

function setup() {
  const fake = createFakeDatabase();
  const manager = new TransactionManager(fake as unknown as Database);
  return { fake, manager };
}

const nameOf = (db: unknown) => (db as { name: string }).name;

describe('TransactionManager', () => {
  it('exposes the base database outside a transaction', () => {
    const { manager } = setup();

    expect(nameOf(manager.db)).toBe('base');
  });

  it('exposes the open transaction inside run', async () => {
    const { manager } = setup();

    const seen = await manager.run(async () => nameOf(manager.db));

    expect(seen).toBe('tx-1');
  });

  it('returns what the work returns', async () => {
    const { manager } = setup();

    const result = await manager.run(async () => 42);

    expect(result).toBe(42);
  });

  it('reuses the open transaction when run is nested', async () => {
    const { fake, manager } = setup();

    const seen = await manager.run(async () =>
      manager.run(async () => nameOf(manager.db)),
    );

    expect(seen).toBe('tx-1');
    expect(fake.transactionsOpened()).toBe(1);
  });

  it('restores the base database and rethrows when the work fails', async () => {
    const { manager } = setup();

    await expect(
      manager.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(nameOf(manager.db)).toBe('base');
  });

  it('keeps concurrent runs isolated from each other', async () => {
    const { manager } = setup();
    const pause = () => new Promise<void>((resolve) => setImmediate(resolve));

    const [first, second] = await Promise.all([
      manager.run(async () => {
        await pause();
        return nameOf(manager.db);
      }),
      manager.run(async () => {
        await pause();
        await pause();
        return nameOf(manager.db);
      }),
    ]);

    expect(first).toBe('tx-1');
    expect(second).toBe('tx-2');
  });
  describe('scope', () => {
    const scope = { workspaceId: 'ws-1', personId: 'person-1' };

    it('sets no context when no scope is given', async () => {
      const { fake, manager } = setup();

      await manager.run(async () => undefined);

      expect(fake.executedParams()).toEqual([]);
    });

    it('sets the workspace and person context before the work runs', async () => {
      const { fake, manager } = setup();

      const seenBeforeWork = await manager.run(
        async () => fake.executedParams(),
        scope,
      );

      expect(seenBeforeWork).toEqual([['ws-1', 'person-1', '', '', '']]);
    });

    it('sets an empty value for the part of the scope that is missing', async () => {
      const { fake, manager } = setup();

      await manager.run(async () => undefined, { personId: 'person-1' });

      expect(fake.executedParams()).toEqual([['', 'person-1', '', '', '']]);
    });

    it('sets the intake token context for the one public link being opened', async () => {
      const { fake, manager } = setup();

      await manager.run(async () => undefined, { intakeToken: 'x7k2m9ab' });

      expect(fake.executedParams()).toEqual([['', '', 'x7k2m9ab', '', '']]);
    });

    it('sets the check-in token context for the one public link being opened', async () => {
      const { fake, manager } = setup();

      await manager.run(async () => undefined, { checkinToken: 'k3m9x2qa' });

      expect(fake.executedParams()).toEqual([['', '', '', 'k3m9x2qa', '']]);
    });

    it('marks the transaction as the backend’s own, for the sender of reminders', async () => {
      const { fake, manager } = setup();

      await manager.run(async () => undefined, { system: true });

      expect(fake.executedParams()).toEqual([['', '', '', '', 'on']]);
    });

    it('refuses a nested run that tries to become the system', async () => {
      const { manager } = setup();

      await expect(
        manager.run(
          async () => manager.run(async () => undefined, { system: true }),
          { workspaceId: 'ws-1' },
        ),
      ).rejects.toThrow(/scope/i);
    });

    it('lets a nested run with the same intake token join', async () => {
      const { fake, manager } = setup();
      const token = { intakeToken: 'x7k2m9ab' };

      await manager.run(
        async () => manager.run(async () => undefined, token),
        token,
      );

      expect(fake.executedParams()).toHaveLength(1);
    });

    it('refuses a nested run that asks for another intake token', async () => {
      const { manager } = setup();

      await expect(
        manager.run(
          async () =>
            manager.run(async () => undefined, { intakeToken: 'second-token' }),
          { intakeToken: 'first-token' },
        ),
      ).rejects.toThrow(/scope/i);
    });

    it('lets a nested run with the same scope join without setting it again', async () => {
      const { fake, manager } = setup();

      await manager.run(
        async () => manager.run(async () => undefined, scope),
        scope,
      );

      expect(fake.executedParams()).toHaveLength(1);
      expect(fake.transactionsOpened()).toBe(1);
    });

    it('lets a nested run without a scope inherit the outer scope', async () => {
      const { manager } = setup();

      await expect(
        manager.run(async () => manager.run(async () => 'ok'), scope),
      ).resolves.toBe('ok');
    });

    it('refuses a nested run that asks for a different scope', async () => {
      const { manager } = setup();

      await expect(
        manager.run(
          async () =>
            manager.run(async () => undefined, {
              ...scope,
              workspaceId: 'ws-2',
            }),
          scope,
        ),
      ).rejects.toThrow(/scope/i);
    });

    it('refuses a nested run that asks for a scope the outer run does not have', async () => {
      const { manager } = setup();

      await expect(
        manager.run(async () => manager.run(async () => undefined, scope)),
      ).rejects.toThrow(/scope/i);
    });
  });
  describe('attempt', () => {
    it('runs the work inside a savepoint when a transaction is open', async () => {
      const { fake, manager } = setup();

      const seen = await manager.run(async () =>
        manager.attempt(async () => nameOf(manager.db)),
      );

      expect(seen).toBe('tx-1');
      expect(fake.savepointsOpened()).toBe(1);
      expect(fake.transactionsOpened()).toBe(1);
    });

    it('returns what the work returns', async () => {
      const { manager } = setup();

      await expect(
        manager.run(async () => manager.attempt(async () => 'result')),
      ).resolves.toBe('result');
    });

    it('rethrows a failure and leaves the outer transaction usable', async () => {
      const { manager } = setup();

      const outcome = await manager.run(async () => {
        await expect(
          manager.attempt(async () => {
            throw new Error('collision');
          }),
        ).rejects.toThrow('collision');
        return nameOf(manager.db);
      });

      expect(outcome).toBe('tx-1');
    });

    it('opens an ordinary transaction when none is open', async () => {
      const { fake, manager } = setup();

      await manager.attempt(async () => nameOf(manager.db));

      expect(fake.transactionsOpened()).toBe(1);
      expect(fake.savepointsOpened()).toBe(0);
    });
  });
});
