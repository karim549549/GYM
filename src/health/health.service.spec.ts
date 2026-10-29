import type { HealthQueryHandler } from './handlers/health-query.handler';
import { HealthService } from './health.service';

function setup() {
  const healthQuery = { pingDatabase: jest.fn().mockResolvedValue(undefined) };
  const service = new HealthService(
    healthQuery as unknown as HealthQueryHandler,
  );
  return { healthQuery, service };
}

describe('HealthService', () => {
  it('reports the database as up when the ping succeeds', async () => {
    const { healthQuery, service } = setup();

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
    expect(healthQuery.pingDatabase).toHaveBeenCalledTimes(1);
  });

  it('lets a failed ping reach the caller instead of hiding it', async () => {
    const { healthQuery, service } = setup();
    const failure = new Error('connection refused');
    healthQuery.pingDatabase.mockRejectedValue(failure);

    await expect(service.check()).rejects.toBe(failure);
  });
});
