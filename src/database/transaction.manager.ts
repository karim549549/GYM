import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { DRIZZLE } from './database.constants';
import type { Database } from './database.module';
import type * as schema from './schema';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export type DbExecutor = PgDatabase<NodePgQueryResultHKT, typeof schema>;

/** Who the database should believe is acting; read by the row level security policies. */
export interface TransactionScope {
  workspaceId?: string;
  personId?: string;
  /** The secret of one public link (the intake form), which lets exactly that link's row be read. */
  intakeToken?: string;
  /** The same for one check-in link. */
  checkinToken?: string;
  /**
   * The backend acting for itself, not for any workspace. Only the reminders table answers to it,
   * so the sender can take everyone's due reminders; everything else is still read one workspace at a time.
   */
  system?: boolean;
}

interface OpenTransaction {
  tx: Transaction;
  scope?: TransactionScope;
}

@Injectable()
export class TransactionManager {
  private readonly storage = new AsyncLocalStorage<OpenTransaction>();

  constructor(@Inject(DRIZZLE) private readonly database: Database) {}

  get db(): DbExecutor {
    return this.storage.getStore()?.tx ?? this.database;
  }

  async run<T>(work: () => Promise<T>, scope?: TransactionScope): Promise<T> {
    const open = this.storage.getStore();
    if (open) {
      if (scope && !this.sameScope(open.scope, scope)) {
        throw new Error(
          'Cannot change the scope of a transaction that is already open',
        );
      }
      return work();
    }

    return this.database.transaction(async (tx) => {
      if (scope) {
        await tx.execute(sql`select
          set_config('app.workspace_id', ${scope.workspaceId ?? ''}, true),
          set_config('app.person_id', ${scope.personId ?? ''}, true),
          set_config('app.intake_token', ${scope.intakeToken ?? ''}, true),
          set_config('app.checkin_token', ${scope.checkinToken ?? ''}, true),
          set_config('app.system', ${scope.system ? 'on' : ''}, true)`);
      }
      return this.storage.run({ tx, scope }, work);
    });
  }

  /**
   * Runs the work as a savepoint inside the open transaction: if it fails, only
   * its own writes (and scope changes) are undone and the transaction stays
   * usable. Without an open transaction it simply opens one.
   */
  async attempt<T>(work: () => Promise<T>): Promise<T> {
    const open = this.storage.getStore();
    if (!open) {
      return this.run(work);
    }
    return open.tx.transaction(async () => work());
  }

  private sameScope(a?: TransactionScope, b?: TransactionScope): boolean {
    return (
      (a?.workspaceId ?? '') === (b?.workspaceId ?? '') &&
      (a?.personId ?? '') === (b?.personId ?? '') &&
      (a?.intakeToken ?? '') === (b?.intakeToken ?? '') &&
      (a?.checkinToken ?? '') === (b?.checkinToken ?? '') &&
      Boolean(a?.system) === Boolean(b?.system)
    );
  }
}
