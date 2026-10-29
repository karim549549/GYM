-- Tenant isolation, enforced by the database.
-- The backend sets app.workspace_id / app.person_id with set_config(..., true)
-- at the start of each transaction. Outside such a transaction both are empty,
-- so every policy below denies: a query that forgets its scope sees nothing.
CREATE FUNCTION app_workspace_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.workspace_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE FUNCTION app_person_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.person_id', true), '')::uuid $$;
--> statement-breakpoint
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workspaces" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "coaches" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "coaches" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "workspaces_tenant" ON "workspaces" FOR ALL
  USING ("id" = app_workspace_id())
  WITH CHECK ("id" = app_workspace_id());
--> statement-breakpoint
CREATE POLICY "coaches_tenant" ON "coaches" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());
--> statement-breakpoint
-- A person can list their own memberships across workspaces (read only), which
-- is how the auth guard finds out which workspaces someone may act in.
CREATE POLICY "coaches_own_memberships" ON "coaches" FOR SELECT
  USING ("person_id" = app_person_id());
-- "people" has no row level security: it is the global identity table, read and
-- written only by the auth module.
