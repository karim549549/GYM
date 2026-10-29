import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';
import type { HealthStatus } from './interfaces/health-status.interface';

@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  check(): Promise<HealthStatus> {
    return this.health.check();
  }
}
