import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

describe('AppModule (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers an unknown api route in the standard error shape with a request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/does-not-exist')
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      path: '/api/v1/does-not-exist',
      requestId: expect.any(String),
    });
    expect(response.headers['x-request-id']).toBe(response.body.requestId);
  });

  it('serves the health check at /health and reaches the database', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', database: 'up' });
  });

  it('does not serve the health check under the api prefix', () => {
    return request(app.getHttpServer()).get('/api/v1/health').expect(404);
  });
});
