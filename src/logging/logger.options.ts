import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import type { Options } from 'pino-http';

interface LoggerOptions {
  nodeEnv: 'development' | 'test' | 'production';
  level?: string;
  stream?: DestinationStream;
}

const SAFE_REQUEST_ID = /^[\w-]{8,64}$/;

const SENSITIVE_FIELDS = [
  'password',
  'token',
  'access_token',
  'refresh_token',
  'phone',
];

export function createLoggerParams({
  nodeEnv,
  level,
  stream,
}: LoggerOptions): Params {
  const options: Options = {
    level: level ?? (nodeEnv === 'test' ? 'silent' : 'info'),

    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id =
        typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming)
          ? incoming
          : randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },

    autoLogging: {
      ignore: (req) => req.url?.startsWith('/health') ?? false,
    },

    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },

    serializers: {
      req: (req: IncomingMessage & { id?: unknown }) => ({
        id: req.id,
        method: req.method,
        url: req.url?.split('?')[0],
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },

    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      ...SENSITIVE_FIELDS,
      ...SENSITIVE_FIELDS.map((field) => `*.${field}`),
    ],

    ...(nodeEnv === 'development' &&
      !stream && {
        transport: { target: 'pino-pretty', options: { singleLine: true } },
      }),
  };

  return { pinoHttp: stream ? [options, stream] : options };
}
