import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DrizzleQueryError } from 'drizzle-orm';
import { AllExceptionsFilter } from './all-exceptions.filter';

function createHost(url = '/clients', id?: string, originalUrl?: string) {
  const response = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url, id, originalUrl }),
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

function postgresError(code: string, message = 'db says no') {
  const cause = Object.assign(new Error(message), {
    code,
    constraint: 'clients_workspace_id_phone_key',
  });
  return new DrizzleQueryError('insert into clients ...', [], cause);
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let logged: jest.SpyInstance;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    logged = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('turns an HttpException into the standard error shape', () => {
    const { host, response } = createHost('/clients/7');

    filter.catch(new NotFoundException('Client not found'), host);

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Client not found',
      path: '/clients/7',
    });
  });

  it('keeps the query string out of the response path and the error log', () => {
    const { host, response } = createHost('/intake?token=abc123secret');

    filter.catch(new Error('boom'), host);

    expect(response.body).toMatchObject({ path: '/intake' });
    expect(JSON.stringify(response.body)).not.toContain('abc123secret');
    expect(String(logged.mock.calls[0][0])).not.toContain('abc123secret');
  });

  it('reports the full original path when the router has stripped a prefix', () => {
    const { host, response } = createHost(
      '/v1/clients',
      undefined,
      '/api/v1/clients?token=abc123secret',
    );

    filter.catch(new NotFoundException(), host);

    expect(response.body).toMatchObject({ path: '/api/v1/clients' });
  });

  it('includes the request id so a user can quote it in a report', () => {
    const { host, response } = createHost('/clients', 'req-abc-12345');

    filter.catch(new NotFoundException('Client not found'), host);

    expect(response.body).toMatchObject({ requestId: 'req-abc-12345' });
  });

  it('keeps the domain code a module put on its exception', () => {
    const { host, response } = createHost();

    filter.catch(
      new ConflictException({
        code: 'CLIENT_LIMIT_REACHED',
        message: 'Upgrade your plan',
      }),
      host,
    );

    expect(response.statusCode).toBe(409);
    expect(response.body).toMatchObject({
      code: 'CLIENT_LIMIT_REACHED',
      message: 'Upgrade your plan',
    });
  });

  it('passes along the details a domain exception carries', () => {
    const { host, response } = createHost();

    filter.catch(
      new UnprocessableEntityException({
        code: 'INVALID_INTAKE_ANSWERS',
        message: 'Some answers need another look',
        details: ['age: required', 'goal: invalid'],
      }),
      host,
    );

    expect(response.statusCode).toBe(422);
    expect(response.body).toMatchObject({
      code: 'INVALID_INTAKE_ANSWERS',
      message: 'Some answers need another look',
      details: ['age: required', 'goal: invalid'],
    });
  });

  it('ignores details that are not a list of text', () => {
    const { host, response } = createHost();

    filter.catch(
      new ConflictException({
        code: 'SOMETHING',
        message: 'x',
        details: { secret: 'object' },
      }),
      host,
    );

    expect(response.body).not.toHaveProperty('details');
  });

  it('reports validation failures with every message in details', () => {
    const { host, response } = createHost();
    const messages = ['name must be a string', 'phone must be valid'];

    filter.catch(
      new BadRequestException({
        statusCode: 400,
        message: messages,
        error: 'Bad Request',
      }),
      host,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
      details: messages,
    });
  });

  it.each([
    ['23505', 409, 'DUPLICATE_RECORD'],
    ['23503', 409, 'REFERENCE_VIOLATION'],
    ['23502', 422, 'CONSTRAINT_VIOLATION'],
    ['23514', 422, 'CONSTRAINT_VIOLATION'],
    ['22P02', 400, 'INVALID_INPUT'],
    ['40001', 503, 'RETRY_LATER'],
    ['40P01', 503, 'RETRY_LATER'],
    ['GY001', 409, 'CLIENT_LIMIT_REACHED'],
  ])('maps Postgres error %s to %i %s', (pgCode, status, code) => {
    const { host, response } = createHost();

    filter.catch(postgresError(pgCode), host);

    expect(response.statusCode).toBe(status);
    expect(response.body).toMatchObject({ statusCode: status, code });
  });

  it('never leaks database internals in a mapped response', () => {
    const { host, response } = createHost();

    filter.catch(
      postgresError('23505', 'duplicate key ... secret_table'),
      host,
    );

    expect(JSON.stringify(response.body)).not.toMatch(
      /secret_table|clients_workspace_id_phone_key|insert into/,
    );
  });

  it('hides the cause of an unknown error behind a generic 500', () => {
    const { host, response } = createHost();

    filter.catch(new Error('password=hunter2 leaked'), host);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      path: '/clients',
    });
  });

  it('logs server errors with the stack and stays quiet for client errors', () => {
    const { host } = createHost();

    filter.catch(new NotFoundException(), host);
    expect(logged).not.toHaveBeenCalled();

    const failure = new Error('boom');
    filter.catch(failure, host);
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('boom'),
      failure.stack,
    );
  });

  it('logs the database error, not the query text and parameters', () => {
    const { host } = createHost();
    const wrapper = new DrizzleQueryError(
      'insert into clients (phone) values ($1)',
      ['+201012345678'],
      new Error('connection terminated'),
    );

    filter.catch(wrapper, host);

    const [message, stack] = logged.mock.calls[0];
    expect(message).toContain('connection terminated');
    expect(`${message}${stack}`).not.toMatch(/\+201012345678|insert into/);
  });

  it('logs unmapped database failures as server errors', () => {
    const { host, response } = createHost();

    filter.catch(postgresError('XX000'), host);

    expect(response.statusCode).toBe(500);
    expect(logged).toHaveBeenCalledTimes(1);
  });
});
