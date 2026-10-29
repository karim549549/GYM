-- A coach sees and changes only the packages of the workspace the request acts in.
-- Like every tenant table: row level security enabled and forced, one policy on the workspace scope,
-- so a query that forgets its scope sees nothing.
ALTER TABLE "packages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "packages" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "packages_tenant" ON "packages" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());
