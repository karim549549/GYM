import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { RemindersService } from '../reminders.service';

/**
 * Looks for due reminders every `REMINDER_POLL_SECONDS` (0 turns it off). A run that is still
 * going when the next tick comes is not doubled up. The loop must outlive a failed run, so the
 * error is logged by name only: it can carry a phone number.
 */
@Injectable()
export class ReminderDispatchJob
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(ReminderDispatchJob.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly reminders: RemindersService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap(): void {
    const seconds = this.config.get('REMINDER_POLL_SECONDS', { infer: true });
    if (seconds === 0) {
      return;
    }
    this.timer = setInterval(() => void this.tick(), seconds * 1000);
    // the job alone must not keep a process alive
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.reminders.dispatchDue();
    } catch (error) {
      this.logger.error(
        `Dispatching reminders failed: ${(error as Error).name}`,
      );
    } finally {
      this.running = false;
    }
  }
}
