import { StarterPackagesPolicy } from './starter-packages.policy';

describe('StarterPackagesPolicy', () => {
  const starters = new StarterPackagesPolicy().starterPackages();

  it('offers one, three and six months, as the product expects a coach to start', () => {
    expect(starters.map((starter) => starter.durationDays)).toEqual([
      30, 90, 180,
    ]);
  });

  it('names them in Arabic', () => {
    for (const starter of starters) {
      expect(starter.name).toMatch(/[\u0600-\u06FF]/);
    }
  });

  it('leaves the price for the coach to set, since only they know it', () => {
    expect(starters.map((starter) => starter.priceMinor)).toEqual([0, 0, 0]);
  });

  it('gives each package its own name', () => {
    expect(new Set(starters.map((starter) => starter.name)).size).toBe(3);
  });

  it('hands out a fresh list each time, so nobody can change the starting point for the next coach', () => {
    const policy = new StarterPackagesPolicy();

    policy.starterPackages()[0].name = 'Changed';
    policy.starterPackages().pop();

    expect(policy.starterPackages()).toHaveLength(3);
    expect(policy.starterPackages()[0].name).not.toBe('Changed');
  });
});
