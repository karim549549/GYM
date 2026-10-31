import { randomInt } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { TransactionManager } from '../../database/transaction.manager';
import { RemindersService } from '../../reminders/reminders.service';
import { SubscriptionDatesPolicy } from '../../subscriptions/policies/subscription-dates.policy';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { CheckinsQueryHandler } from '../handlers/checkins-query.handler';
import { CheckinFormPolicy } from '../policies/checkin-form.policy';
import { CheckinSchedulePolicy } from '../policies/checkin-schedule.policy';
import { CheckinStatePolicy } from '../policies/checkin-state.policy';
import { BaseCheckinOrchestrator } from './base-checkin.orchestrator';

/** The schedule a batch of check-ins is made for. */
export interface CheckinSource {
  id: string;
  clientId: string;
  sendAt: string;
}

/**
 * What the two flows that make check-ins ahead of their day share (setting a schedule, and the job
 * that keeps the next few created): making the rows, and planning the link that goes to the client
 * on each day. A day that already has a check-in is left alone, so doing it twice is harmless.
 */
export abstract class BaseCheckinCreationOrchestrator extends BaseCheckinOrchestrator {
  // 62 characters, 8 of them, as for the intake link: short enough to trust in a WhatsApp message
  private static readonly ALPHABET =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  private static readonly TOKEN_LENGTH = 8;

  constructor(
    checkinsQuery: CheckinsQueryHandler,
    config: ConfigService<Env, true>,
    dates: SubscriptionDatesPolicy,
    statePolicy: CheckinStatePolicy,
    transactions: TransactionManager,
    workspaces: WorkspacesService,
    protected readonly schedulePolicy: CheckinSchedulePolicy,
    protected readonly formPolicy: CheckinFormPolicy,
    protected readonly reminders: RemindersService,
  ) {
    super(checkinsQuery, config, dates, statePolicy, transactions, workspaces);
  }

  /** Makes the check-ins for these days and plans their links. Returns how many were made. */
  protected async createFor(
    workspaceId: string,
    source: CheckinSource,
    days: string[],
  ): Promise<number> {
    const created = await this.checkinsQuery.createMany(
      days.map((dueOn) => ({
        workspaceId,
        clientId: source.clientId,
        scheduleId: source.id,
        dueOn,
        token: this.newToken(),
        formVersion: CheckinFormPolicy.VERSION,
      })),
    );
    const handle = await this.handleOf(workspaceId);
    await this.reminders.scheduleCheckins(
      workspaceId,
      created.map((checkin) => ({
        clientId: checkin.clientId,
        checkinId: checkin.id,
        dueOn: checkin.dueOn,
        sendAt: source.sendAt,
        link: this.linkFor(handle, checkin.token),
      })),
    );
    return created.length;
  }

  /** How far ahead check-ins are made. */
  protected horizonFrom(today: string): string {
    return this.dates.addDays(today, 28);
  }

  private newToken(): string {
    const { ALPHABET, TOKEN_LENGTH } = BaseCheckinCreationOrchestrator;
    return Array.from(
      { length: TOKEN_LENGTH },
      () => ALPHABET[randomInt(ALPHABET.length)],
    ).join('');
  }
}
