import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocksContext, OnOneInstance, WithoutOverlapping } from '@nestjs/locks';
import type { Env } from '../../config/env.schema';
import { SchedulingService } from '../../scheduling/scheduling.service';
import { RemindersService } from '../reminders.service';

@Injectable()
export class ReminderDispatchJob implements OnApplicationBootstrap {
  constructor(
    private readonly reminders: RemindersService,
    private readonly config: ConfigService<Env, true>,
    private readonly scheduling: SchedulingService,
    private readonly locks: LocksContext,
  ) {}

  onApplicationBootstrap(): void {
    this.scheduling.every(
      'reminders:dispatch',
      this.config.get('REMINDER_POLL_SECONDS', { infer: true }),
      () => this.execute(),
    );
  }

  @OnOneInstance({ key: 'reminders:dispatch' })
  @WithoutOverlapping()
  async execute(): Promise<void> {
    await this.reminders.dispatchDue(this.locks.signal);
  }
}
