import { IntakeLinkPolicy } from './intake-link.policy';

const now = new Date('2026-10-26T12:00:00Z');
const hours = (n: number) => new Date(now.getTime() + n * 3_600_000);

describe('IntakeLinkPolicy', () => {
  const policy = new IntakeLinkPolicy();

  it('is open before it expires and before anyone has submitted', () => {
    expect(
      policy.statusOf({ expiresAt: hours(1), submittedAt: null }, now),
    ).toEqual({ outcome: 'open' });
  });

  it('expires at the moment it is due, not a moment after', () => {
    expect(policy.statusOf({ expiresAt: now, submittedAt: null }, now)).toEqual(
      { outcome: 'expired' },
    );
  });

  it('is expired once it is due', () => {
    expect(
      policy.statusOf({ expiresAt: hours(-1), submittedAt: null }, now),
    ).toEqual({ outcome: 'expired' });
  });

  it('is closed once submitted, even if it has also expired since', () => {
    expect(
      policy.statusOf({ expiresAt: hours(-48), submittedAt: hours(-72) }, now),
    ).toEqual({ outcome: 'submitted' });
  });

  it('is closed once submitted while it would still have been valid', () => {
    expect(
      policy.statusOf({ expiresAt: hours(100), submittedAt: hours(-1) }, now),
    ).toEqual({ outcome: 'submitted' });
  });

  it('lasts fourteen days', () => {
    expect(IntakeLinkPolicy.VALID_DAYS).toBe(14);
  });
});
