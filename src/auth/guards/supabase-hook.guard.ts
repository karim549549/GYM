import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Webhook } from 'standardwebhooks';
import type { Env } from '../../config/env.schema';
import { InvalidHookSignatureException } from '../exceptions/auth-exceptions';

interface HookRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
  hookPayload?: unknown;
}

/**
 * Authenticates a call Supabase makes to one of our hooks. These calls carry no user
 * token, only a signature over the exact bytes of the body (the Standard Webhooks scheme),
 * so the raw body must be kept (\`rawBody: true\` when the app is created). Every failure
 * is the same refusal: it never says which part was wrong. With no secret configured
 * nothing passes.
 */
@Injectable()
export class SupabaseHookGuard implements CanActivate {
  // the dashboard shows the secret as v1,whsec_<base64>; the library wants the base64
  private static readonly SECRET_PREFIX = 'v1,whsec_';
  private static readonly SIGNING_HEADERS = [
    'webhook-id',
    'webhook-timestamp',
    'webhook-signature',
  ];

  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<HookRequest>();
    const secret = this.config.get('SUPABASE_HOOK_SECRET', { infer: true });
    if (!secret || !request.rawBody) {
      throw new InvalidHookSignatureException();
    }

    const headers: Record<string, string> = {};
    for (const name of SupabaseHookGuard.SIGNING_HEADERS) {
      const value = request.headers[name];
      if (typeof value !== 'string') {
        throw new InvalidHookSignatureException();
      }
      headers[name] = value;
    }

    try {
      request.hookPayload = new Webhook(
        secret.replace(SupabaseHookGuard.SECRET_PREFIX, ''),
      ).verify(request.rawBody, headers);
    } catch {
      // a bad signature, a stale timestamp and a malformed secret all look the same from outside
      throw new InvalidHookSignatureException();
    }
    return true;
  }
}
