import { ConfigModule } from '@nestjs/config';
import { LocksStorage, type LockStore } from '@nestjs/locks';
import { lockStoreContract } from '@nestjs/locks/testing';
import { Test, type TestingModule } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import { DatabaseModule, type Database } from '../src/database/database.module';
import { DRIZZLE } from '../src/database/database.constants';
import { PostgresLockStore } from '../src/database/postgres-lock.store';
import { TransactionManager } from '../src/database/transaction.manager';
import { randomBytes } from 'node:crypto';

describe('PostgresLockStore contract against PostgreSQL', () => {
  let moduleRef: TestingModule;
  let database: Database;
  let store: PostgresLockStore;
  const keys = new Set<string>();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
    }).compile();
    database = moduleRef.get<Database>(DRIZZLE);
    store = moduleRef.get(PostgresLockStore);
    await moduleRef.init();
    await database.execute(sql`select 1 from locks limit 0`);
  });

  afterAll(async () => {
    try {
      if (database && keys.size > 0) {
        await database.execute(
          sql`delete from locks where key in (${sql.join(
            [...keys].map((key) => sql`${key}`),
            sql`, `,
          )})`,
        );
      }
    } finally {
      await moduleRef?.close();
    }
  });

  const trackedStore: LockStore = {
    acquire: (key, owner, ttl) => {
      keys.add(key);
      return store.acquire(key, owner, ttl);
    },
    renew: (key, owner, ttl) => store.renew(key, owner, ttl),
    release: (key, owner) => store.release(key, owner),
  };

  for (const contractCase of lockStoreContract(() => trackedStore, {
    concurrent: true,
  })) {
    it(contractCase.name, contractCase.run);
  }

  it('commits a lease independently of a rolled-back business transaction', async () => {
    const key = `test:independent-lease:${randomBytes(12).toString('hex')}`;
    keys.add(key);
    const rollback = new Error('roll back business work');
    await expect(
      moduleRef.get(TransactionManager).run(async () => {
        expect(await store.acquire(key, 'owner', 60_000)).toMatchObject({
          acquired: true,
        });
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    expect(await store.release(key, 'owner')).toBe(true);
  });

  it('registers the real store, and keeps lock records inaccessible to API roles', async () => {
    expect(moduleRef.get(LocksStorage).source).toBe(store);
    const result = await database.execute<{ allowed: boolean }>(sql`
      select has_table_privilege('anon', 'public.locks', 'SELECT')
        or has_table_privilege('authenticated', 'public.locks', 'SELECT')
        or has_sequence_privilege('anon', 'public.locks_fencing_token_seq', 'USAGE')
        or has_sequence_privilege('authenticated', 'public.locks_fencing_token_seq', 'USAGE') as allowed
    `);
    expect(result.rows[0].allowed).toBe(false);
  });
});
