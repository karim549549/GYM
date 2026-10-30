-- A coach sees and changes only the payment methods of the workspace the request acts in.
-- Like every tenant table: row level security enabled and forced, one policy on the workspace scope,
-- so a query that forgets its scope sees nothing.
ALTER TABLE "payment_channels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_channels" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "payment_channels_tenant" ON "payment_channels" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());
