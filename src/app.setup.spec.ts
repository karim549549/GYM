import {
  Body,
  Controller,
  Get,
  INestApplication,
  Logger,
  NotFoundException,
  Post,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import request from 'supertest';
import { configureApp, setupApiDocs } from './app.setup';

class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  age?: number;
}

@Controller('probe')
class ProbeController {
  @Post('clients')
  create(@Body() dto: CreateClientDto) {
    return {
      isDto: dto instanceof CreateClientDto,
      name: dto.name,
      age: dto.age,
    };
  }

  @Get('ok')
  ok() {
    return { ok: true };
  }

  @Get('missing')
  missing() {
    throw new NotFoundException('Client not found');
  }

  @Get('boom')
  boom() {
    throw new Error('secret internals');
  }
}

@Controller({ path: 'health', version: VERSION_NEUTRAL })
class HealthProbeController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}

describe('configureApp', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController, HealthProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('does not serve routes without the /api/v1 prefix', async () => {
    await request(app.getHttpServer()).get('/api/v1/probe/ok').expect(200);
    await request(app.getHttpServer()).get('/probe/ok').expect(404);
    await request(app.getHttpServer()).get('/api/probe/ok').expect(404);
    await request(app.getHttpServer()).get('/v1/probe/ok').expect(404);
  });

  it('keeps the health check outside the prefix and version', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer()).get('/api/v1/health').expect(404);
  });

  it('accepts a valid body and hands the controller a DTO instance', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/probe/clients')
      .send({ name: 'Ahmed', age: 30 })
      .expect(201);

    expect(response.body).toEqual({ isDto: true, name: 'Ahmed', age: 30 });
  });

  it('rejects a missing required field with every problem listed', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/probe/clients')
      .send({ age: -1 })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      path: '/api/v1/probe/clients',
    });
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.stringContaining('name'),
        expect.stringContaining('age'),
      ]),
    );
  });

  it('rejects properties the DTO does not declare', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/probe/clients')
      .send({ name: 'Ahmed', role: 'admin' })
      .expect(400);

    expect(response.body.details).toEqual([
      expect.stringContaining('role should not exist'),
    ]);
  });

  it('answers HTTP errors in the standard shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/probe/missing')
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Client not found',
      path: '/api/v1/probe/missing',
    });
  });

  it('answers unexpected errors with a generic 500 and no internals', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const response = await request(app.getHttpServer())
      .get('/api/v1/probe/boom')
      .expect(500);

    expect(response.body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('secret internals');
  });
});

describe('setupApiDocs', () => {
  let app: INestApplication;
  let document: Record<string, any>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    setupApiDocs(app);
    await app.init();

    const response = await request(app.getHttpServer())
      .get('/docs/openapi.json')
      .expect(200);
    document = response.body;
  });

  afterAll(async () => {
    await app.close();
  });

  it('publishes an OpenAPI document with the versioned paths', () => {
    expect(document.openapi).toMatch(/^3\./);
    expect(document.paths).toHaveProperty(['/api/v1/probe/clients', 'post']);
    expect(document.paths).toHaveProperty(['/api/v1/probe/ok', 'get']);
  });

  it('derives request schemas from class-validator with no swagger decorators', () => {
    const schema = document.components.schemas.CreateClientDto;

    expect(schema.required).toEqual(['name']);
    expect(schema.properties.name.type).toBe('string');
    expect(schema.properties.age).toMatchObject({ type: 'number', minimum: 0 });
    expect(schema.required).not.toContain('age');
  });

  it('declares bearer authentication for every route', () => {
    expect(document.components.securitySchemes.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
    expect(document.security).toEqual([{ bearer: [] }]);
  });

  it('serves the interactive docs page', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/html');
  });
});
