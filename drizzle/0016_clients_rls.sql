-- A coach sees and changes only the clients of the workspace the request acts in.
-- Like every tenant table: row level security enabled and forced, one policy on the workspace scope,
-- so a query that forgets its scope sees nothing.
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "clients" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "clients_tenant" ON "clients" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());
