import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { CheckinsService } from '../checkins.service';

/**
 * Keeps the next month of check-ins created: once at start-up and then every
 * `CHECKIN_TOPUP_SECONDS` (0 turns it off). Running it from several instances is harmless, since a
 * day that has a check-in is left alone. The error is logged by name only: it can carry personal data.
 */
@Injectable()
export class CheckinTopUpJob
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(CheckinTopUpJob.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly checkins: CheckinsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap(): void {
    const seconds = this.config.get('CHECKIN_TOPUP_SECONDS', { infer: true });
    if (seconds === 0) {
      return;
    }
    void this.tick();
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
      await this.checkins.topUp();
    } catch (error) {
      this.logger.error(
        `Topping up check-ins failed: ${(error as Error).name}`,
      );
    } finally {
      this.running = false;
    }
  }
}
