import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { BaseQueryHandler } from '../../common/handlers/base-query.handler';
import { paymentChannels } from '../../database/schema';
import type {
  NewPaymentChannel,
  PaymentChannelChanges,
  PaymentChannelRecord,
} from '../interfaces/payment-channel.interface';

const RECORD = {
  id: paymentChannels.id,
  method: paymentChannels.method,
  account: paymentChannels.account,
  url: paymentChannels.url,
};

/** Data access for the `payment_channels` table. Row level security keeps it to one workspace. */
@Injectable()
export class PaymentChannelsQueryHandler extends BaseQueryHandler {
  /** In the order they were added. A coach has a handful, so this is a plain list. */
  list(): Promise<PaymentChannelRecord[]> {
    return this.db
      .select(RECORD)
      .from(paymentChannels)
      .orderBy(asc(paymentChannels.createdAt));
  }

  async create(
    workspaceId: string,
    channel: NewPaymentChannel,
  ): Promise<PaymentChannelRecord> {
    const [created] = await this.db
      .insert(paymentChannels)
      .values({ workspaceId, ...channel })
      .returning(RECORD);
    return created;
  }

  /** Sets only the fields given. Null when it is not visible, which includes another workspace's. */
  async update(
    id: string,
    changes: PaymentChannelChanges,
  ): Promise<PaymentChannelRecord | null> {
    const values = {
      ...(changes.method !== undefined && { method: changes.method }),
      ...(changes.account !== undefined && { account: changes.account }),
      ...(changes.url !== undefined && { url: changes.url }),
    };
    if (Object.keys(values).length === 0) {
      const rows = await this.db
        .select(RECORD)
        .from(paymentChannels)
        .where(eq(paymentChannels.id, id))
        .limit(1);
      return this.firstOrNull(rows);
    }
    const rows = await this.db
      .update(paymentChannels)
      .set(values)
      .where(eq(paymentChannels.id, id))
      .returning(RECORD);
    return this.firstOrNull(rows);
  }

  /** False when it is not visible, which includes another workspace's. */
  async remove(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(paymentChannels)
      .where(eq(paymentChannels.id, id))
      .returning({ id: paymentChannels.id });
    return rows.length > 0;
  }
}
