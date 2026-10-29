import { InvitationLimitPolicy } from './invitation-limit.policy';

const policy = new InvitationLimitPolicy();

describe('InvitationLimitPolicy', () => {
  it('allows another while under the limit', () => {
    expect(policy.check(InvitationLimitPolicy.MAX_OPEN - 1).outcome).toBe(
      'allowed',
    );
  });

  it('refuses at the limit, so an owner cannot flood numbers with invitations', () => {
    expect(policy.check(InvitationLimitPolicy.MAX_OPEN).outcome).toBe(
      'limit_reached',
    );
  });
});
