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
    // Server-side key that bypasses Supabase's access rules. Never leaves the backend.
    SUPABASE_SECRET_KEY: z.string().min(1),
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
export type Env = Omit<ParsedEnv, 'PUBLIC_APP_URL' | 'PROGRAM_SESSION_SECRET'> & {
  PUBLIC_APP_URL: string;
  PROGRAM_SESSION_SECRET: string;
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
  };
}
