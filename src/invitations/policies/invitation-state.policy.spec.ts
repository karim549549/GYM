import { InvitationState } from '../enums/invitation-state.enum';
import { InvitationStatus } from '../enums/invitation-status.enum';
import { InvitationStatePolicy } from './invitation-state.policy';

const policy = new InvitationStatePolicy();
const now = new Date('2027-01-15T12:00:00Z');
const later = new Date('2027-01-20T00:00:00Z');
const earlier = new Date('2027-01-10T00:00:00Z');

describe('InvitationStatePolicy', () => {
  it('is pending while it is open and not past its date', () => {
    expect(
      policy.stateOf(
        { status: InvitationStatus.PENDING, expiresAt: later },
        now,
      ).outcome,
    ).toBe(InvitationState.PENDING);
  });

  it('is expired once its date has passed, without anything having been stored', () => {
    expect(
      policy.stateOf(
        { status: InvitationStatus.PENDING, expiresAt: earlier },
        now,
      ).outcome,
    ).toBe(InvitationState.EXPIRED);
  });

  it('is expired at the very moment of its date', () => {
    expect(
      policy.stateOf({ status: InvitationStatus.PENDING, expiresAt: now }, now)
        .outcome,
    ).toBe(InvitationState.EXPIRED);
  });

  it.each([
    [InvitationStatus.ACCEPTED, InvitationState.ACCEPTED],
    [InvitationStatus.DECLINED, InvitationState.DECLINED],
    [InvitationStatus.REVOKED, InvitationState.REVOKED],
  ])('keeps %s as it is, whatever the date', (status, expected) => {
    expect(policy.stateOf({ status, expiresAt: earlier }, now).outcome).toBe(
      expected,
    );
    expect(policy.stateOf({ status, expiresAt: later }, now).outcome).toBe(
      expected,
    );
  });
});
