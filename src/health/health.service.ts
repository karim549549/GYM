import { Injectable } from '@nestjs/common';
import { HealthQueryHandler } from './handlers/health-query.handler';
import type { HealthStatus } from './interfaces/health-status.interface';

/** The health module's interface: is the application able to serve requests. */
@Injectable()
export class HealthService {
  constructor(private readonly healthQuery: HealthQueryHandler) {}

  async check(): Promise<HealthStatus> {
    await this.healthQuery.pingDatabase();
    return { status: 'ok', database: 'up' };
  }
}
