import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocksContext, OnOneInstance, WithoutOverlapping } from '@nestjs/locks';
import type { Env } from '../../config/env.schema';
import { SchedulingService } from '../../scheduling/scheduling.service';
import { CheckinsService } from '../checkins.service';

@Injectable()
export class CheckinTopUpJob implements OnApplicationBootstrap {
  constructor(
    private readonly checkins: CheckinsService,
    private readonly config: ConfigService<Env, true>,
    private readonly scheduling: SchedulingService,
    private readonly locks: LocksContext,
  ) {}

  onApplicationBootstrap(): void {
    this.scheduling.every(
      'checkins:top-up',
      this.config.get('CHECKIN_TOPUP_SECONDS', { infer: true }),
      () => this.execute(),
      true,
    );
  }

  @OnOneInstance({ key: 'checkins:top-up' })
  @WithoutOverlapping()
  async execute(): Promise<void> {
    await this.checkins.topUp(this.locks.signal);
  }
}
