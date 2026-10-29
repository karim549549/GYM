-- Internal tables are only ever used by the backend role that owns them. Turning
-- row level security on, with no policies and without forcing it, keeps the owner
-- working while denying any other role (Supabase's public API roles) by default.
ALTER TABLE "people" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;
