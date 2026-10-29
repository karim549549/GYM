import { WorkspaceRole } from '../../members/enums/workspace-role.enum';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Public } from '../../common/decorators/public.decorator';
import {
  InvalidTokenException,
  MissingTokenException,
  NotRegisteredException,
  WorkspaceRequiredException,
} from '../exceptions/auth-exceptions';
import type { VerifiedIdentity } from '../interfaces/verified-identity.interface';
import type { Principal } from '../interfaces/principal.interface';
import { AuthGuard } from './auth.guard';

const identity: VerifiedIdentity = {
  authUserId: '8f14e45f-ceea-467a-9575-1c2f4e5e1b6a',
  phone: '+201012345678',
};

const principal: Principal = {
  personId: 'person-1',
  authUserId: identity.authUserId,
  fullName: 'Sara Ali',
  memberships: [
    { workspaceId: 'ws-1', role: WorkspaceRole.COACH, isOwner: true },
  ],
  workspaceId: 'ws-1',
  role: WorkspaceRole.COACH,
  isOwner: true,
};

class PlainController {
  handler() {}
}

class HealthController {
  @Public()
  handler() {}
}

@Public()
class OpenController {
  handler() {}
}

function setup() {
  const supabase = { verify: jest.fn().mockResolvedValue(identity) };
  const auth = { resolvePrincipal: jest.fn().mockResolvedValue(principal) };
  const guard = new AuthGuard(
    new Reflector(),
    supabase as never,
    auth as never,
  );

  const run = (
    target: new () => { handler(): void },
    headers: Record<string, string | string[]> = {},
  ) => {
    const request: Record<string, any> = { headers };
    const context = {
      getHandler: () => target.prototype.handler,
      getClass: () => target,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { request, result: guard.canActivate(context) };
  };

  return { supabase, auth, run };
}

describe('AuthGuard', () => {
  it('lets a public handler through without looking at the token', async () => {
    const { supabase, run } = setup();

    await expect(run(HealthController).result).resolves.toBe(true);
    expect(supabase.verify).not.toHaveBeenCalled();
  });

  it('lets a handler of a public class through', async () => {
    const { supabase, run } = setup();

    await expect(run(OpenController).result).resolves.toBe(true);
    expect(supabase.verify).not.toHaveBeenCalled();
  });

  it.each([
    ['no authorization header', {}],
    ['a non-bearer scheme', { authorization: 'Basic dXNlcjpwYXNz' }],
    ['a bearer scheme without a token', { authorization: 'Bearer' }],
    ['a bearer scheme with an empty token', { authorization: 'Bearer   ' }],
    ['a token with extra parts', { authorization: 'Bearer a b' }],
  ])('refuses a request with %s', async (_label, headers) => {
    const { supabase, run } = setup();

    await expect(run(PlainController, headers).result).rejects.toBeInstanceOf(
      MissingTokenException,
    );
    expect(supabase.verify).not.toHaveBeenCalled();
  });

  it('passes the bearer token to the verifier', async () => {
    const { supabase, run } = setup();

    await run(PlainController, { authorization: 'bearer abc.def.ghi' }).result;

    expect(supabase.verify).toHaveBeenCalledWith('abc.def.ghi');
  });

  it('lets a rejected token through nowhere', async () => {
    const { supabase, run } = setup();
    supabase.verify.mockRejectedValue(new InvalidTokenException());

    await expect(
      run(PlainController, { authorization: 'Bearer bad' }).result,
    ).rejects.toBeInstanceOf(InvalidTokenException);
  });

  it('attaches the principal and the access token for a registered account', async () => {
    const { run } = setup();

    const { request, result } = run(PlainController, {
      authorization: 'Bearer good',
    });

    await expect(result).resolves.toBe(true);
    expect(request.principal).toEqual(principal);
    expect(request.accessToken).toBe('good');
  });

  it('hands the requested workspace to the principal lookup', async () => {
    const { auth, run } = setup();

    await run(PlainController, {
      authorization: 'Bearer good',
      'x-workspace-id': 'ws-9',
    }).result;

    expect(auth.resolvePrincipal).toHaveBeenCalledWith(identity, 'ws-9');
  });

  it('uses the first value when the workspace header is repeated', async () => {
    const { auth, run } = setup();

    await run(PlainController, {
      authorization: 'Bearer good',
      'x-workspace-id': ['ws-1', 'ws-2'],
    }).result;

    expect(auth.resolvePrincipal).toHaveBeenCalledWith(identity, 'ws-1');
  });

  it('refuses a verified account that has not registered', async () => {
    const { auth, run } = setup();
    auth.resolvePrincipal.mockResolvedValue(undefined);

    await expect(
      run(PlainController, { authorization: 'Bearer good' }).result,
    ).rejects.toBeInstanceOf(NotRegisteredException);
  });

  it('lets workspace errors from the lookup reach the caller', async () => {
    const { auth, run } = setup();
    auth.resolvePrincipal.mockRejectedValue(new WorkspaceRequiredException());

    await expect(
      run(PlainController, { authorization: 'Bearer good' }).result,
    ).rejects.toBeInstanceOf(WorkspaceRequiredException);
  });
});
