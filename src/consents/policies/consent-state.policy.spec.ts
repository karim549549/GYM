import { ConsentStatus } from '../enums/consent-status.enum';
import { ConsentStatePolicy } from './consent-state.policy';

const policy = new ConsentStatePolicy();

describe('ConsentStatePolicy', () => {
  it('is none when nothing was ever recorded', () => {
    expect(policy.statusOf(null).outcome).toBe(ConsentStatus.NONE);
  });

  it('is granted when the newest choice grants', () => {
    expect(policy.statusOf({ granted: true }).outcome).toBe(
      ConsentStatus.GRANTED,
    );
  });

  it('is withdrawn when the newest choice refuses, so a refusal is not the same as never asked', () => {
    expect(policy.statusOf({ granted: false }).outcome).toBe(
      ConsentStatus.WITHDRAWN,
    );
  });
});
