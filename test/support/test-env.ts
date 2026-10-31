/**
 * The environment the HTTP tests run the app in. It must be imported before the app, because
 * the configuration is validated as soon as the app's modules load. Jest gives each test file
 * its own copy of `process.env`, so setting these here reaches no other file, and the app
 * only ever talks to the fakes, whatever keys the developer has in .env.
 */
export const HOOK_SECRET_BASE64 = Buffer.from(
  'e2e-hook-signing-secret-0123456789',
).toString('base64');

// tests drive the sender by hand, so nothing sends in the background
process.env.REMINDER_POLL_SECONDS = '0';
process.env.CHECKIN_TOPUP_SECONDS = '0';
process.env.STORAGE_DRIVER = 'local';
process.env.SUPABASE_HOOK_SECRET = `v1,whsec_${HOOK_SECRET_BASE64}`;
