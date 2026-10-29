-- Check-ins and their schedules are tenant tables like the rest: a coach sees and changes only the
-- rows of the workspace the request acts in, and a query that forgets its scope sees nothing.
ALTER TABLE "checkin_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "checkin_schedules" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "checkin_schedules_tenant" ON "checkin_schedules" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
ALTER TABLE "checkins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "checkins" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "checkins_tenant" ON "checkins" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
-- The job that keeps the next check-ins created works through every workspace's schedules, so it
-- acts in no single workspace. As the system it may only READ the schedules (to learn which
-- workspaces have one); it creates the check-ins one workspace at a time, in that workspace's scope.
CREATE POLICY "checkin_schedules_system_read" ON "checkin_schedules" FOR SELECT
  USING (app_is_system());--> statement-breakpoint
-- The check-in form opens with no login, so there is no workspace to act in. The link's secret
-- token is the credential: the backend sets it for the one request, and this one policy lets that
-- single check-in be READ, nothing else. An empty token matches nothing.
CREATE FUNCTION app_checkin_token() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.checkin_token', true), '') $$;--> statement-breakpoint
CREATE POLICY "checkins_by_token" ON "checkins" FOR SELECT
  USING ("token" = app_checkin_token());
