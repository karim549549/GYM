import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .optional(),
    SUPABASE_URL: z.url().transform((url) => url.replace(/\/+$/, '')),
    SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    DATABASE_URL: z.url(),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
    DATABASE_SSL_CA: z.string().min(1).default('certs/supabase-ca.crt'),
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_ROOT: z.string().min(1).default('./storage-data'),
    // Base of our local download routes, including /api/v1/storage.
    STORAGE_BASE_URL: z
      .url()
      .transform((url) => url.replace(/\/+$/, ''))
      .optional(),
    STORAGE_SIGNING_KEY: z.string().min(32).optional(),
    STORAGE_PUBLIC_URL: z
      .url()
      .transform((url) => url.replace(/\/+$/, ''))
      .optional(),
    STORAGE_S3_ENDPOINT: z.url().optional(),
    STORAGE_S3_REGION: z.string().min(1).default('us-east-1'),
    STORAGE_S3_FORCE_PATH_STYLE: z.stringbool().default(false),
    STORAGE_S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    STORAGE_S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    STORAGE_S3_SESSION_TOKEN: z.string().min(1).optional(),
    STORAGE_S3_PUBLIC_BUCKET: z.string().min(1).default('gym-public'),
    STORAGE_S3_FILES_BUCKET: z.string().min(1).default('gym-files'),
    STORAGE_S3_PHOTOS_BUCKET: z.string().min(1).default('gym-photos'),
    // 'mock' records messages instead of sending them (development and tests only).
    WHATSAPP_PROVIDER: z.enum(['mock', 'meta']).default('mock'),
    // Signs the calls Supabase makes to our Send SMS hook (dashboard: Auth > Hooks), as v1,whsec_<base64>.
    SUPABASE_HOOK_SECRET: z.string().min(1).optional(),
    // How often the sender looks for reminders that are due; 0 turns it off (tests, or a second
    // instance that should not send). Several instances are safe: each reminder is claimed once.
    REMINDER_POLL_SECONDS: z.coerce.number().int().min(0).default(60),
    // How often the next month of check-ins is topped up; 0 turns it off (tests). Safe from several instances.
    CHECKIN_TOPUP_SECONDS: z.coerce.number().int().min(0).default(3600),
    // Where the web app lives, for the links we hand out (an intake form opens at <this>/intake/<handle>/<token>).
    PUBLIC_APP_URL: z
      .url()
      .transform((url) => url.replace(/\/+$/, ''))
      .optional(),
    // Signs the sessions a client gets from their program link (HMAC). Long and random; changing it signs every client out.
    PROGRAM_SESSION_SECRET: z.string().min(32).optional(),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === 'production' && env.STORAGE_DRIVER !== 's3') {
      context.addIssue({
        code: 'custom',
        path: ['STORAGE_DRIVER'],
        message: 'use s3 in production: local container files are not durable',
      });
    }
    if (env.STORAGE_DRIVER === 's3') {
      for (const name of [
        'STORAGE_S3_ACCESS_KEY_ID',
        'STORAGE_S3_SECRET_ACCESS_KEY',
        'STORAGE_PUBLIC_URL',
      ] as const) {
        if (!env[name])
          context.addIssue({
            code: 'custom',
            path: [name],
            message: 'required when STORAGE_DRIVER=s3',
          });
      }
      const buckets = [
        env.STORAGE_S3_PUBLIC_BUCKET,
        env.STORAGE_S3_FILES_BUCKET,
        env.STORAGE_S3_PHOTOS_BUCKET,
      ];
      if (new Set(buckets).size !== buckets.length)
        context.addIssue({
          code: 'custom',
          path: ['STORAGE_S3_PHOTOS_BUCKET'],
          message:
            'public files, private files and photos must use separate buckets',
        });
    }
  })
  .refine(
    (env) =>
      !(env.NODE_ENV === 'production' && env.WHATSAPP_PROVIDER === 'mock'),
    {
      path: ['WHATSAPP_PROVIDER'],
      message:
        'the mock cannot run in production: no verification code or reminder would ever be sent',
    },
  )
  .refine(
    (env) => !(env.NODE_ENV === 'production' && !env.SUPABASE_HOOK_SECRET),
    {
      path: ['SUPABASE_HOOK_SECRET'],
      message:
        'required in production: without it every verification code call from Supabase would be refused',
    },
  )
  .refine((env) => !(env.NODE_ENV === 'production' && !env.PUBLIC_APP_URL), {
    path: ['PUBLIC_APP_URL'],
    message:
      'required in production: every link we hand out would point at localhost',
  })
  .refine(
    (env) => !(env.NODE_ENV === 'production' && !env.PROGRAM_SESSION_SECRET),
    {
      path: ['PROGRAM_SESSION_SECRET'],
      message:
        'required in production: without it no client could stay signed in on their program link',
    },
  );

// in development the web app runs locally, so the setting can be left out there
const DEVELOPMENT_APP_URL = 'http://localhost:3001';
// development and tests only: a known secret would let anyone sign a session
const DEVELOPMENT_PROGRAM_SECRET = 'development-only-program-session-secret';

type ParsedEnv = z.infer<typeof envSchema>;
export type Env = Omit<
  ParsedEnv,
  'PUBLIC_APP_URL' | 'PROGRAM_SESSION_SECRET' | 'STORAGE_BASE_URL'
> & {
  PUBLIC_APP_URL: string;
  PROGRAM_SESSION_SECRET: string;
  STORAGE_BASE_URL: string;
};

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${problems}`);
  }
  return {
    ...result.data,
    PUBLIC_APP_URL: result.data.PUBLIC_APP_URL ?? DEVELOPMENT_APP_URL,
    PROGRAM_SESSION_SECRET:
      result.data.PROGRAM_SESSION_SECRET ?? DEVELOPMENT_PROGRAM_SECRET,
    STORAGE_BASE_URL:
      result.data.STORAGE_BASE_URL ??
      `http://localhost:${result.data.PORT}/api/v1/storage`,
  };
}
