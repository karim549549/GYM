import { readFileSync } from 'node:fs';
import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DRIZZLE, PG_POOL } from './database.constants';
import * as schema from './schema';
import { TransactionManager } from './transaction.manager';
import { PostgresLockStore } from './postgres-lock.store';
import { SchedulingModule } from '../scheduling/scheduling.module';

export type Database = NodePgDatabase<typeof schema>;

@Global()
@Module({
  imports: [SchedulingModule],
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Pool({
          connectionString: config.getOrThrow<string>('DATABASE_URL'),
          ssl: {
            ca: readFileSync(
              config.get<string>('DATABASE_SSL_CA', 'certs/supabase-ca.crt'),
            ),
          },
          max: config.get<number>('DATABASE_POOL_MAX', 10),
        }),
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool): Database => drizzle(pool, { schema }),
    },
    TransactionManager,
    PostgresLockStore,
  ],
  exports: [DRIZZLE, TransactionManager],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
