import { randomInt } from 'node:crypto';
import { TransactionManager } from '../../database/transaction.manager';
import { PaymentRequestNotFoundException } from '../exceptions/payment-request-exceptions';
import { PaymentRequestsQueryHandler } from '../handlers/payment-requests-query.handler';
import type {
  PaymentRequestRecord,
  StoredPaymentRequest,
} from '../interfaces/payment-request.interface';
import { PaymentRequestStatePolicy } from '../policies/payment-request-state.policy';

/**
 * What the payment request flows share: making a token nobody has, finding a request by the secret in
 * its address, and what the coach sees of one. The token only finds the row; it expires with the link.
 */
export abstract class BasePaymentRequestOrchestrator {
  // 62 characters, 12 of them: about 71 bits, as for a program link
  private static readonly ALPHABET =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  private static readonly TOKEN_LENGTH = 12;
  private static readonly ATTEMPTS = 3;

  constructor(
    protected readonly paymentRequests: PaymentRequestsQueryHandler,
    protected readonly statePolicy: PaymentRequestStatePolicy,
    protected readonly transactions: TransactionManager,
  ) {}

  /** Runs the work with a fresh token. A taken token is retried, each try a savepoint so it cannot spoil the transaction. */
  protected async withFreeToken<T>(
    work: (token: string) => Promise<T>,
    attempt = 1,
  ): Promise<T> {
    try {
      return await this.transactions.attempt(() => work(this.newToken()));
    } catch (error) {
      if (
        !this.violates(error, 'payment_requests_token_unique') ||
        attempt >= BasePaymentRequestOrchestrator.ATTEMPTS
      ) {
        throw error;
      }
      return this.withFreeToken(work, attempt + 1);
    }
  }

  /** The request, or the reason this address is no good. Runs under the token and nothing wider. */
  protected async openRequest(token: string): Promise<StoredPaymentRequest> {
    const request = await this.transactions.run(
      () => this.paymentRequests.findByToken(token),
      { paymentToken: token },
    );
    if (!request) {
      throw new PaymentRequestNotFoundException();
    }
    return request;
  }

  protected record(request: StoredPaymentRequest): PaymentRequestRecord {
    return {
      id: request.id,
      subscriptionId: request.subscriptionId,
      clientId: request.clientId,
      token: request.token,
      clientName: request.clientName,
      packageName: request.packageName,
      amountMinor: request.amountMinor,
      currency: request.currency,
      note: request.note,
      expiresAt: request.expiresAt,
      paidAt: request.paidAt,
      paidMethod: request.paidMethod,
      paymentId: request.paymentId,
      createdAt: request.createdAt,
      state: this.statePolicy.of(request, new Date()),
      receiptUrl: null,
    };
  }

  private violates(error: unknown, constraintName: string): boolean {
    for (
      let link: unknown = error, depth = 0;
      link && depth < 5;
      link = (link as { cause?: unknown }).cause, depth += 1
    ) {
      const { code, constraint } = link as {
        code?: string;
        constraint?: string;
      };
      if (code === '23505' && constraint === constraintName) {
        return true;
      }
    }
    return false;
  }

  private newToken(): string {
    const { ALPHABET, TOKEN_LENGTH } = BasePaymentRequestOrchestrator;
    return Array.from(
      { length: TOKEN_LENGTH },
      () => ALPHABET[randomInt(ALPHABET.length)],
    ).join('');
  }
}
