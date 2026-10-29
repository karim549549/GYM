import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { LocksEvents } from '@nestjs/locks';
import type { Subscription } from 'rxjs';

@Injectable()
export class SchedulingService implements OnModuleDestroy {
  private readonly logger = new Logger(SchedulingService.name);
  private readonly intervals = new Set<string>();
  private readonly eventsSubscription: Subscription;

  constructor(
    private readonly registry: SchedulerRegistry,
    events: LocksEvents,
  ) {
    this.eventsSubscription = events.events$.subscribe((event) => {
      if (event.type === 'lock-lost') {
        this.logger.error(`Scheduled job lease lost: ${event.key}`);
      }
    });
  }

  every(
    key: string,
    seconds: number,
    work: () => Promise<unknown>,
    runOnStartup = false,
  ): void {
    if (seconds === 0) {
      return;
    }
    if (this.registry.doesExist('interval', key)) {
      throw new Error(`Scheduled job already registered: ${key}`);
    }
    const timer = setInterval(() => void this.run(key, work), seconds * 1000);
    timer.unref();
    this.registry.addInterval(key, timer);
    this.intervals.add(key);
    if (runOnStartup) {
      void this.run(key, work);
    }
  }

  onModuleDestroy(): void {
    for (const key of this.intervals) {
      if (this.registry.doesExist('interval', key)) {
        this.registry.deleteInterval(key);
      }
    }
    this.intervals.clear();
    this.eventsSubscription.unsubscribe();
  }

  private async run(key: string, work: () => Promise<unknown>): Promise<void> {
    try {
      await work();
    } catch (error) {
      // Provider and database messages may contain personal data or SQL parameters.
      this.logger.error(
        `Scheduled job ${key} failed: ${error instanceof Error ? error.name : 'UnknownError'}`,
      );
    }
  }
}
