-- Reminders are a tenant table like the rest: a coach's request sees and changes only its own
-- workspace's rows, and a query that forgets its scope sees nothing.
ALTER TABLE "reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reminders" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "reminders_tenant" ON "reminders" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
-- The sender works through everyone's due reminders and so acts in no single workspace. The
-- backend marks that one transaction as the system's (app.system = 'on') and this policy lets
-- it reach THIS table only: the client, the workspace and the rest are still read one workspace
-- at a time, after the reminder has been taken. Nothing is on unless the backend sets it.
CREATE FUNCTION app_is_system() RETURNS boolean
  LANGUAGE sql STABLE
  AS $$ SELECT coalesce(current_setting('app.system', true), '') = 'on' $$;--> statement-breakpoint
CREATE POLICY "reminders_system" ON "reminders" FOR ALL
  USING (app_is_system())
  WITH CHECK (app_is_system());
