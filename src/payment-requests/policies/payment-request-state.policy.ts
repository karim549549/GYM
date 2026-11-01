import { Injectable } from '@nestjs/common';
import type { PaymentRequestState } from '../interfaces/payment-request.interface';

/**
 * Where a payment request stands: open until the client reports paying or its date passes, and
 * confirmed once the coach recorded that payment.
 */
@Injectable()
export class PaymentRequestStatePolicy {
  /** How long a link stays open, counted from the day it was made. */
  static readonly VALID_DAYS = 14;

  of(
    request: {
      paidAt: Date | null;
      expiresAt: Date;
      paymentId?: string | null;
    },
    now: Date,
  ): PaymentRequestState {
    if (request.paymentId) {
      return 'confirmed';
    }
    if (request.paidAt) {
      return 'paid';
    }
    return request.expiresAt <= now ? 'expired' : 'waiting';
  }

  expiryFrom(now: Date): Date {
    const expiresAt = new Date(now);
    expiresAt.setUTCDate(
      expiresAt.getUTCDate() + PaymentRequestStatePolicy.VALID_DAYS,
    );
    return expiresAt;
  }
}
