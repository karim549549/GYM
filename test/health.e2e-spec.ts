import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { validateEnv } from '../src/config/env.schema';
import { DatabaseModule } from '../src/database/database.module';
import { HealthModule } from '../src/health/health.module';
import { HealthService } from '../src/health/health.service';

describe('HealthService against the database', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        DatabaseModule,
        HealthModule,
      ],
    }).compile();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('reaches the real database', async () => {
    await expect(moduleRef.get(HealthService).check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
  });
});
