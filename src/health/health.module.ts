import { Module } from '@nestjs/common';
import { HealthQueryHandler } from './handlers/health-query.handler';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService, HealthQueryHandler],
  exports: [HealthService],
})
export class HealthModule {}
