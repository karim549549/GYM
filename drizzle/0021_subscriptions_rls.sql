-- A coach sees and changes only the subscriptions, freezes and payments of the workspace the
-- request acts in. Like every tenant table: row level security enabled and forced, one policy on
-- the workspace scope, so a query that forgets its scope sees nothing.
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "subscriptions_tenant" ON "subscriptions" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
ALTER TABLE "subscription_freezes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscription_freezes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "subscription_freezes_tenant" ON "subscription_freezes" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "payments_tenant" ON "payments" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());
