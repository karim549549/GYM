import { Global, Module } from '@nestjs/common';
import { LocksModule } from '@nestjs/locks';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulingService } from './scheduling.service';

@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    LocksModule.forRoot({ ttl: '30s', storeTimeout: '5s' }),
  ],
  providers: [SchedulingService],
  exports: [SchedulingService],
})
export class SchedulingModule {}
