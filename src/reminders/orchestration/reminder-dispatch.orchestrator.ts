import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { ClientNotFoundException } from '../../clients/exceptions/client-exceptions';
import { ConsentsService } from '../../consents/consents.service';
import { ClientConsentType } from '../../consents/enums/client-consent-type.enum';
import { TransactionManager } from '../../database/transaction.manager';
import { WhatsAppTemplate } from '../../whatsapp/enums/whatsapp-template.enum';
import { WhatsAppClient } from '../../whatsapp/whatsapp.client';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { ReminderKind } from '../enums/reminder-kind.enum';
import { RemindersQueryHandler } from '../handlers/reminders-query.handler';
import type { ClaimedReminder } from '../interfaces/reminder.interface';

/**
 * Takes over `RemindersService.dispatchDue`. The due reminders of every workspace are taken in one
 * step as the system; each is then delivered inside its own workspace, so the client and the
 * coach's brand are read through the usual tenant scope. A reminder is marked sent when it is
 * taken, so one that cannot be delivered is marked with why and left, never retried into a
 * duplicate. Returns how many were delivered.
 */
@Injectable()
export class ReminderDispatchOrchestrator {
  static readonly BATCH = 50;

  constructor(
    private readonly remindersQuery: RemindersQueryHandler,
    private readonly clients: ClientsService,
    private readonly workspaces: WorkspacesService,
    private readonly whatsapp: WhatsAppClient,
    private readonly consents: ConsentsService,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(signal?: AbortSignal): Promise<number> {
    signal?.throwIfAborted();
    const claimed = await this.transactions.run(
      () => this.remindersQuery.claimDue(ReminderDispatchOrchestrator.BATCH),
      { system: true },
    );

    return claimed.reduce(async (pendingCount, reminder) => {
      const delivered = await pendingCount;
      signal?.throwIfAborted();
      const failure = await this.deliver(reminder, signal);
      if (failure) {
        await this.transactions.run(
          () => this.remindersQuery.markFailed(reminder.id, failure),
          { system: true },
        );
        return delivered;
      }
      return delivered + 1;
    }, Promise.resolve(0));
  }

  /** The reason it could not be delivered, or nothing when it was. */
  private async deliver(
    reminder: ClaimedReminder,
    signal?: AbortSignal,
  ): Promise<string | null> {
    let details;
    try {
      details = await this.transactions.run(
        async () => ({
          client: await this.clients.findOne(
            reminder.workspaceId,
            reminder.clientId,
          ),
          workspace: await this.workspaces.findCurrent(reminder.workspaceId),
          agreed: await this.consents.isGranted(
            reminder.workspaceId,
            reminder.clientId,
            [ClientConsentType.WHATSAPP_NOTIFICATIONS],
          ),
        }),
        { workspaceId: reminder.workspaceId },
      );
    } catch (error) {
      // a client removed since the reminder was planned has nobody to tell
      if (error instanceof ClientNotFoundException) {
        return 'client_removed';
      }
      throw error;
    }

    signal?.throwIfAborted();
    // a message is sent only to a client who agreed to receive them, and never again once they withdraw
    if (!details.agreed) {
      return 'no_consent';
    }

    try {
      await this.whatsapp.sendTemplate({
        to: details.client.phone,
        template: this.templateFor(reminder.kind),
        language: 'ar',
        params: [
          details.client.fullName,
          details.workspace.brandName,
          this.detailOf(reminder),
        ],
      });
      return null;
    } catch {
      // the provider's error can carry the number and the text; only the fact is kept
      return 'send_failed';
    }
  }

  private templateFor(kind: ReminderKind): WhatsAppTemplate {
    switch (kind) {
      case ReminderKind.CHECKIN_DUE:
        return WhatsAppTemplate.CHECKIN_DUE;
      case ReminderKind.EXPIRED:
        return WhatsAppTemplate.SUBSCRIPTION_EXPIRED;
      default:
        return WhatsAppTemplate.SUBSCRIPTION_EXPIRING;
    }
  }

  /** The last placeholder: where to answer for a check-in, the end date for a subscription. */
  private detailOf(reminder: ClaimedReminder): string {
    return reminder.kind === ReminderKind.CHECKIN_DUE
      ? reminder.payload.link
      : reminder.payload.endsOn;
  }
}
