import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Logger, LoggerModule, Params, PinoLogger } from 'nestjs-pino';
import type { Options } from 'pino-http';
import request from 'supertest';
import { Writable } from 'node:stream';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { createLoggerParams } from './logger.options';

const LEVEL = { warn: 40, error: 50 };

@Controller('probe')
class ProbeController {
  constructor(private readonly logger: PinoLogger) {}

  @Get('log')
  log() {
    this.logger.info(
      { user: { phone: '+201012345678', password: 'hunter2' } },
      'inside request',
    );
    return { ok: true };
  }

  @Get('missing')
  missing() {
    throw new NotFoundException('Client not found');
  }

  @Get('boom')
  boom() {
    throw new Error('exploded');
  }
}

@Controller('api/v1/program')
class ProgramProbeController {
  @Get(':token')
  open() {
    return { ok: true };
  }
}

@Controller('health')
class HealthProbeController {
  @Get()
  check() {
    return { ok: true };
  }
}

type LogLine = Record<string, any>;

// nestjs-pino keeps its root logger in static state, so a second app in the
// same process would write to the first app's stream. One app per file.
async function startApp() {
  const lines: LogLine[] = [];
  const raw: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      const text = chunk.toString();
      raw.push(text);
      lines.push(JSON.parse(text));
      callback();
    },
  });

  const moduleRef = await Test.createTestingModule({
    imports: [
      LoggerModule.forRoot(
        createLoggerParams({
          nodeEnv: 'production',
          level: 'info',
          stream,
        }),
      ),
    ],
    controllers: [
      ProbeController,
      ProgramProbeController,
      HealthProbeController,
    ],
  }).compile();

  const app: INestApplication = moduleRef.createNestApplication({
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();

  const reset = () => {
    lines.length = 0;
    raw.length = 0;
  };

  return { app, lines, reset, output: () => raw.join('') };
}

describe('createLoggerParams', () => {
  let app: INestApplication;
  let lines: LogLine[];
  let reset: () => void;
  let output: () => string;

  beforeAll(async () => {
    ({ app, lines, reset, output } = await startApp());
  });

  beforeEach(() => {
    reset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('tags every line of a request with one id and echoes it back', async () => {
    const response = await request(app.getHttpServer())
      .get('/probe/log')
      .expect(200);

    const id = response.headers['x-request-id'];
    const inside = lines.find((line) => line.msg === 'inside request');
    const completed = lines.find((line) => line.msg === 'request completed');
    expect(id).toEqual(expect.any(String));
    expect(inside?.req?.id).toBe(id);
    expect(completed?.req?.id).toBe(id);
    expect(completed?.res?.statusCode).toBe(200);
  });

  it('reuses a well-formed id sent by the caller', async () => {
    const response = await request(app.getHttpServer())
      .get('/probe/log')
      .set('x-request-id', 'client-req-12345')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('client-req-12345');
  });

  it('replaces a caller id that could pollute the logs', async () => {
    const response = await request(app.getHttpServer())
      .get('/probe/log')
      .set('x-request-id', 'has spaces and "quotes"')
      .expect(200);

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('redacts sensitive fields logged by application code', async () => {
    await request(app.getHttpServer()).get('/probe/log').expect(200);

    const inside = lines.find((line) => line.msg === 'inside request');
    expect(inside?.user).toEqual({
      phone: '[Redacted]',
      password: '[Redacted]',
    });
    expect(output()).not.toMatch(/\+201012345678|hunter2/);
  });

  it('never writes the authorization header', async () => {
    await request(app.getHttpServer())
      .get('/probe/log')
      .set('Authorization', 'Bearer secret-token-value')
      .expect(200);

    expect(output()).not.toContain('secret-token-value');
  });

  it('drops the query string from the logged url', async () => {
    await request(app.getHttpServer())
      .get('/probe/log?token=abc123secret')
      .expect(200);

    const completed = lines.find((line) => line.msg === 'request completed');
    expect(completed?.req?.url).toBe('/probe/log');
    expect(output()).not.toContain('abc123secret');
  });

  it('masks the secret in the address of a public link, and never writes the program session', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/program/Pq7xK2mZ9aLd')
      .set('x-program-session', 'v1.session-payload-value.signature-value')
      .expect(200);

    const completed = lines.find((line) => line.msg === 'request completed');
    expect(completed?.req?.url).toBe('/api/v1/program/[redacted]');
    expect(output()).not.toContain('Pq7xK2mZ9aLd');
    expect(output()).not.toContain('session-payload-value');
  });

  it('does not log health checks', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);

    expect(output()).not.toContain('/health');
  });

  it('logs client errors as warnings and server errors as errors', async () => {
    await request(app.getHttpServer()).get('/probe/missing').expect(404);
    await request(app.getHttpServer()).get('/probe/boom').expect(500);

    const requestLines = lines.filter((line) => line.res);
    expect(requestLines.map((line) => line.level)).toEqual([
      LEVEL.warn,
      LEVEL.error,
    ]);
  });

  it('carries the request id on errors logged by the exception filter', async () => {
    const response = await request(app.getHttpServer())
      .get('/probe/boom')
      .expect(500);

    const id = response.headers['x-request-id'];
    const filterLine = lines.find(
      (line) => line.level === LEVEL.error && /exploded/.test(String(line.msg)),
    );
    expect(filterLine?.req?.id).toBe(id);
  });
});

describe('createLoggerParams options', () => {
  const optionsOf = (params: Params) =>
    (Array.isArray(params.pinoHttp)
      ? params.pinoHttp[0]
      : params.pinoHttp) as Options;

  it('uses the level it is given', () => {
    const params = createLoggerParams({
      nodeEnv: 'production',
      level: 'debug',
    });

    expect(optionsOf(params).level).toBe('debug');
  });

  it('defaults to info in production and to silent under test', () => {
    expect(optionsOf(createLoggerParams({ nodeEnv: 'production' })).level).toBe(
      'info',
    );
    expect(optionsOf(createLoggerParams({ nodeEnv: 'test' })).level).toBe(
      'silent',
    );
  });

  it('pretty-prints in development only', () => {
    expect(
      optionsOf(createLoggerParams({ nodeEnv: 'development' })),
    ).toHaveProperty('transport.target', 'pino-pretty');
    expect(
      optionsOf(createLoggerParams({ nodeEnv: 'production' })),
    ).not.toHaveProperty('transport');
  });
});
