import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import { DatabaseModule } from '../src/database/database.module';
import { TransactionManager } from '../src/database/transaction.manager';

describe('TransactionManager against the database', () => {
  let moduleRef: TestingModule;
  let manager: TransactionManager;

  const labelsInTable = async () => {
    const result = await manager.db.execute(
      sql`select label from tx_test.items order by label`,
    );
    return result.rows.map((row) => row.label);
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
    }).compile();
    manager = moduleRef.get(TransactionManager);

    await manager.db.execute(sql`create schema if not exists tx_test`);
    await manager.db.execute(
      sql`create table if not exists tx_test.items (id serial primary key, label text not null)`,
    );
    await manager.db.execute(sql`truncate tx_test.items`);
  });

  afterAll(async () => {
    await manager.db.execute(sql`drop schema if exists tx_test cascade`);
    await moduleRef.close();
  });

  it('commits every write made inside run', async () => {
    await manager.run(async () => {
      await manager.db.execute(
        sql`insert into tx_test.items (label) values ('committed-a')`,
      );
      await manager.db.execute(
        sql`insert into tx_test.items (label) values ('committed-b')`,
      );
    });

    expect(await labelsInTable()).toEqual(['committed-a', 'committed-b']);
  });

  it('rolls back every write when the work throws', async () => {
    await expect(
      manager.run(async () => {
        await manager.db.execute(
          sql`insert into tx_test.items (label) values ('rolled-back')`,
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await labelsInTable()).not.toContain('rolled-back');
  });

  describe('attempt', () => {
    const insert = (label: string) =>
      manager.db.execute(
        sql`insert into tx_test.items (label) values (${label})`,
      );

    it('undoes only the failed attempt and commits the rest of the transaction', async () => {
      await manager.run(async () => {
        await insert('attempt-before');
        await expect(
          manager.attempt(async () => {
            await insert('attempt-inside');
            throw new Error('collision');
          }),
        ).rejects.toThrow('collision');
        await insert('attempt-after');
      });

      const labels = await labelsInTable();
      expect(labels).toEqual(
        expect.arrayContaining(['attempt-before', 'attempt-after']),
      );
      expect(labels).not.toContain('attempt-inside');
    });

    it('keeps the writes of an attempt that succeeds', async () => {
      await manager.run(async () => {
        await manager.attempt(() => insert('attempt-kept'));
      });

      expect(await labelsInTable()).toContain('attempt-kept');
    });

    it('undoes a scope change made inside the failed attempt', async () => {
      const scopeAfter = await manager.run(async () => {
        await expect(
          manager.attempt(async () => {
            await manager.db.execute(
              sql`select set_config('app.workspace_id', '11111111-1111-4111-8111-111111111111', true)`,
            );
            throw new Error('collision');
          }),
        ).rejects.toThrow('collision');
        const result = await manager.db.execute(
          sql`select current_setting('app.workspace_id', true) as scope`,
        );
        return result.rows[0].scope;
      });

      expect([null, '']).toContain(scopeAfter);
    });

    it('behaves like run when no transaction is open', async () => {
      await expect(
        manager.attempt(async () => {
          await insert('attempt-alone');
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      expect(await labelsInTable()).not.toContain('attempt-alone');
    });
  });
});
