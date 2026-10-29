import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import { validateEnv } from '../src/config/env.schema';
import { DatabaseModule } from '../src/database/database.module';
import { TransactionManager } from '../src/database/transaction.manager';
import { WorkspaceRole } from '../src/members/enums/workspace-role.enum';

describe('workspace_members against the database', () => {
  let moduleRef: TestingModule;
  let tx: TransactionManager;

  const column = async (name: string) => {
    const { rows } = await tx.db.execute<{
      is_nullable: string;
      column_default: string | null;
      data_type: string;
    }>(
      sql`select is_nullable, column_default, data_type
          from information_schema.columns
          where table_name = 'workspace_members' and column_name = ${name}`,
    );
    return rows[0];
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        DatabaseModule,
      ],
    }).compile();
    tx = moduleRef.get(TransactionManager);
  });

  afterAll(() => moduleRef.close());

  it('lists in the database the same roles as the enum, no more and no fewer', async () => {
    const { rows } = await tx.db.execute<{ definition: string }>(
      sql`select pg_get_constraintdef(oid) as definition
          from pg_constraint where conname = 'workspace_members_role_check'`,
    );

    const allowed = [...rows[0].definition.matchAll(/'(\w+)'/g)].map(
      (match) => match[1],
    );
    expect(allowed.sort((a, b) => String(a).localeCompare(String(b)))).toEqual(
      Object.values(WorkspaceRole).sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    );
  });

  it('does not treat owner as a role: ownership is its own flag', async () => {
    expect(Object.values(WorkspaceRole)).not.toContain('owner');

    const isOwner = await column('is_owner');
    expect(isOwner.data_type).toBe('boolean');
    expect(isOwner.is_nullable).toBe('NO');
    expect(isOwner.column_default).toBe('false');
  });

  it('makes a plain coach the default member', async () => {
    const role = await column('role');

    expect(role.column_default).toContain(WorkspaceRole.COACH);
  });

  it('has no table left under the old name', async () => {
    const { rows } = await tx.db.execute<{ name: string }>(
      sql`select table_name as name from information_schema.tables
          where table_schema = 'public' and table_name = 'coaches'`,
    );

    expect(rows).toEqual([]);
  });
});
