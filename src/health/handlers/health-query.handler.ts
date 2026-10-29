import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { BaseQueryHandler } from '../../common/handlers/base-query.handler';

/** Data access for the health check: proves the database answers. */
@Injectable()
export class HealthQueryHandler extends BaseQueryHandler {
  async pingDatabase(): Promise<void> {
    await this.db.execute(sql`select 1`);
  }
}
