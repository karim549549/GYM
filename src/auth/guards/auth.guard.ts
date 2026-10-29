import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { AuthService } from '../auth.service';
import {
  MissingTokenException,
  NotRegisteredException,
} from '../exceptions/auth-exceptions';
import { SupabaseAuthClient } from '../integrations/supabase-auth.client';
import type { Principal } from '../interfaces/principal.interface';

interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  principal?: Principal;
  accessToken?: string;
}

const BEARER = /^Bearer\s+(\S+)$/i;

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseAuthClient,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const token =
      typeof header === 'string' ? BEARER.exec(header)?.[1] : undefined;
    if (!token) {
      throw new MissingTokenException();
    }

    const identity = await this.supabase.verify(token);

    const requested = request.headers['x-workspace-id'];
    const principal = await this.auth.resolvePrincipal(
      identity,
      Array.isArray(requested) ? requested[0] : requested,
    );
    if (!principal) {
      throw new NotRegisteredException();
    }
    request.principal = principal;
    request.accessToken = token;
    return true;
  }
}
