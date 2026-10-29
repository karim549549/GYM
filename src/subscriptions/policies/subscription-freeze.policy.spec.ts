import { SubscriptionDatesPolicy } from './subscription-dates.policy';
import { SubscriptionFreezePolicy } from './subscription-freeze.policy';

const policy = new SubscriptionFreezePolicy(new SubscriptionDatesPolicy());

describe('SubscriptionFreezePolicy', () => {
  it('pushes the end date back by the days spent frozen', () => {
    expect(
      policy.resume({
        frozenOn: '2027-02-01',
        resumedOn: '2027-02-11',
        endsOn: '2027-02-28',
      }),
    ).toEqual({ outcome: 'resume', daysFrozen: 10, endsOn: '2027-03-10' });
  });

  it('changes nothing when resumed the same day', () => {
    expect(
      policy.resume({
        frozenOn: '2027-02-01',
        resumedOn: '2027-02-01',
        endsOn: '2027-02-28',
      }),
    ).toEqual({ outcome: 'resume', daysFrozen: 0, endsOn: '2027-02-28' });
  });

  it('refuses to resume before the freeze began', () => {
    expect(
      policy.resume({
        frozenOn: '2027-02-10',
        resumedOn: '2027-02-09',
        endsOn: '2027-02-28',
      }).outcome,
    ).toBe('before_freeze');
  });
});
