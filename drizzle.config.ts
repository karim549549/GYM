import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

const url = new URL(process.env.DIRECT_URL!);

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema',
  out: './drizzle',
  dbCredentials: {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: { ca: readFileSync('certs/supabase-ca.crt', 'utf8') },
  },
});
