-- A coach sees and changes only the reminder messages of the workspace the request acts in.
-- Like every tenant table: row level security enabled and forced, one policy on the workspace scope,
-- so a query that forgets its scope sees nothing.
ALTER TABLE "reminder_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reminder_messages" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "reminder_messages_tenant" ON "reminder_messages" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());
