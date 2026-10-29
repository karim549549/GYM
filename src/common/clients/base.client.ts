import { Logger } from '@nestjs/common';

export interface RetryOptions {
  /** Total tries, the first one included, from 1 (no retrying) to 5. */
  attempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
}

export interface ClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
  /** Longest a single attempt may take. Default 5s. */
  timeoutMs?: number;
  /** Longest the whole call may take, every attempt and wait included. Default 10s. */
  totalTimeoutMs?: number;
  retry?: RetryOptions;
  fetch?: typeof fetch;
}

export interface ClientRequest {
  method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Appended to the base url. */
  path: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  /** Bytes are sent as they are; anything else is sent as JSON. */
  body?: unknown;
  /**
   * Whether repeating this call is harmless. Reads, PUT and DELETE are repeated by
   * default and POST and PATCH are not; a caller says `true` for a POST that is safe to
   * repeat (a sign-in) and `false` for a read that must not be.
   */
  retry?: boolean;
}

export interface ClientReply {
  status: number;
  /** Parsed JSON, or undefined when the body is empty or not JSON. */
  body: any;
}

/**
 * The one way this backend calls another system over HTTP. It builds the request,
 * times it out, retries what is safe to retry and turns "could not reach it" into the
 * subclass's own error, so a client never needs a try/catch around the call. It does
 * not judge HTTP statuses: a 4xx or 5xx is handed back for the subclass to map,
 * because only the subclass knows what the other system means by it.
 */
export abstract class BaseClient {
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly DEFAULT_TIMEOUT_MS = 5_000;
  private static readonly DEFAULT_TOTAL_TIMEOUT_MS = 10_000;
  private static readonly DEFAULT_RETRY: RetryOptions = {
    attempts: 3,
    baseDelayMs: 200,
    maxDelayMs: 2_000,
  };
  // 429 and 500 are left out on purpose: waiting is the other system's call to make for
  // the first, and the second is more often a bug than an outage.
  private static readonly RETRIABLE_STATUSES = new Set([502, 503, 504]);
  private static readonly REPEATABLE_METHODS = new Set([
    'GET',
    'HEAD',
    'PUT',
    'DELETE',
  ]);

  private readonly logger = new Logger(this.constructor.name);

  protected constructor(private readonly options: ClientOptions) {
    const attempts = options.retry?.attempts;
    if (
      attempts !== undefined &&
      !(
        Number.isInteger(attempts) &&
        attempts >= 1 &&
        attempts <= BaseClient.MAX_ATTEMPTS
      )
    ) {
      throw new Error(
        `retry attempts must be a whole number from 1 to ${BaseClient.MAX_ATTEMPTS}`,
      );
    }
  }

  /** The error to throw when the other system cannot be reached, after any retries. */
  protected abstract unavailable(): Error;

  protected async send(request: ClientRequest): Promise<ClientReply> {
    const retry = this.options.retry ?? BaseClient.DEFAULT_RETRY;
    const attempts = this.mayRepeat(request) ? retry.attempts : 1;
    const deadline =
      Date.now() +
      (this.options.totalTimeoutMs ?? BaseClient.DEFAULT_TOTAL_TIMEOUT_MS);

    return this.sendAttempt(request, retry, attempts, deadline, 1);
  }

  private async sendAttempt(
    request: ClientRequest,
    retry: RetryOptions,
    attempts: number,
    deadline: number,
    attempt: number,
  ): Promise<ClientReply> {
    const reply = await this.attempt(request, deadline - Date.now());
    const retriable =
      reply === undefined || BaseClient.RETRIABLE_STATUSES.has(reply.status);
    if (!retriable) {
      return reply;
    }

    // Out of attempts, or the wait would eat the time left: give up now.
    const wait = this.backoff(attempt, retry);
    if (attempt >= attempts || Date.now() + wait >= deadline) {
      if (reply === undefined) {
        throw this.unavailable();
      }
      return reply;
    }

    this.logger.warn(
      `${request.method} ${request.path} failed (${reply?.status ?? 'no reply'}), attempt ${attempt} of ${attempts}`,
    );
    await new Promise((resolve) => setTimeout(resolve, wait));
    return this.sendAttempt(request, retry, attempts, deadline, attempt + 1);
  }

  /** One try. Undefined means nothing came back: refused, reset or timed out. */
  private async attempt(
    request: ClientRequest,
    timeLeftMs: number,
  ): Promise<ClientReply | undefined> {
    const url = new URL(`${this.options.baseUrl}${request.path}`);
    for (const [key, value] of Object.entries(request.query ?? {})) {
      url.searchParams.set(key, value);
    }
    const hasBody = request.body !== undefined;
    const isRaw = request.body instanceof Uint8Array;

    try {
      const response = await (this.options.fetch ?? fetch)(url, {
        method: request.method,
        headers: {
          ...(hasBody && !isRaw && { 'content-type': 'application/json' }),
          ...this.options.headers,
          ...request.headers,
        },
        body: isRaw
          ? (request.body as Uint8Array<ArrayBuffer>)
          : hasBody
            ? JSON.stringify(request.body)
            : undefined,
        signal: AbortSignal.timeout(
          Math.max(
            1,
            Math.min(
              this.options.timeoutMs ?? BaseClient.DEFAULT_TIMEOUT_MS,
              timeLeftMs,
            ),
          ),
        ),
      });
      const body = await response.json().catch(() => undefined);
      return { status: response.status, body };
    } catch {
      // the cause can carry hosts and addresses, so it is dropped, not logged
      return undefined;
    }
  }

  private mayRepeat(request: ClientRequest): boolean {
    return request.retry ?? BaseClient.REPEATABLE_METHODS.has(request.method);
  }

  /** Exponential backoff in ms, jittered between half and all of the delay. */
  private backoff(attempt: number, retry: RetryOptions): number {
    const delay = Math.min(
      retry.baseDelayMs * 2 ** (attempt - 1),
      retry.maxDelayMs ?? Number.POSITIVE_INFINITY,
    );
    return delay / 2 + (Math.random() * delay) / 2;
  }
}
