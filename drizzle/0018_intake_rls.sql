-- The three tables a client's details end up in are tenant tables like the rest: a coach sees
-- and changes only the rows of the workspace the request acts in, and a query that forgets its
-- scope sees nothing.
ALTER TABLE "intake_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "intake_links" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "intake_responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "intake_responses" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "measurements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "measurements" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "intake_links_tenant" ON "intake_links" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
CREATE POLICY "intake_responses_tenant" ON "intake_responses" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
CREATE POLICY "measurements_tenant" ON "measurements" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
-- The form opens with no login, so there is no workspace to act in. The link's secret token
-- is the credential: the backend sets it for the one request, and this one policy lets that
-- single link be READ, nothing else. An empty token matches nothing.
CREATE FUNCTION app_intake_token() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.intake_token', true), '') $$;--> statement-breakpoint
CREATE POLICY "intake_links_by_token" ON "intake_links" FOR SELECT
  USING ("token" = app_intake_token());
