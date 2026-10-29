import { Inject, Injectable } from '@nestjs/common';
import {
  LocksStorage,
  type LockAcquireResult,
  type LockStore,
} from '@nestjs/locks';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from './database.constants';
import type { Database } from './database.module';

/** Each statement autocommits independently: lease renewals never join a business transaction. */
@Injectable()
export class PostgresLockStore implements LockStore {
  constructor(
    @Inject(DRIZZLE) private readonly database: Database,
    storage: LocksStorage,
  ) {
    storage.registerSource(this);
  }

  async acquire(
    key: string,
    owner: string,
    ttl: number,
  ): Promise<LockAcquireResult> {
    const result = await this.database.execute<{ fencing_token: string }>(sql`
      insert into locks (key, owner, fencing_token, expires_at)
      values (${key}, ${owner}, nextval('locks_fencing_token_seq'),
        clock_timestamp() + ${ttl}::bigint * interval '1 millisecond')
      on conflict (key) do update set
        owner = excluded.owner,
        fencing_token = greatest(locks.fencing_token + 1, nextval('locks_fencing_token_seq')),
        expires_at = clock_timestamp() + ${ttl}::bigint * interval '1 millisecond'
      where locks.owner is null or locks.expires_at <= clock_timestamp()
      returning fencing_token
    `);
    const row = result.rows[0];
    return row
      ? { acquired: true, fencingToken: Number(row.fencing_token) }
      : { acquired: false };
  }

  async renew(key: string, owner: string, ttl: number): Promise<boolean> {
    const result = await this.database.execute(sql`
      update locks set expires_at = clock_timestamp() + ${ttl}::bigint * interval '1 millisecond'
      where key = ${key} and owner = ${owner} and expires_at > clock_timestamp()
      returning key
    `);
    return result.rows.length === 1;
  }

  async release(key: string, owner: string): Promise<boolean> {
    const result = await this.database.execute(sql`
      update locks set owner = null
      where key = ${key} and owner = ${owner} and expires_at > clock_timestamp()
      returning key
    `);
    return result.rows.length === 1;
  }
}
