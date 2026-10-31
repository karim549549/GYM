-- A coach sees and changes only the program links of the workspace the request acts in.
ALTER TABLE "program_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "program_links" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "program_links_tenant" ON "program_links" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
-- The program page opens with no login. The link's token is the credential: the backend sets it for
-- one request, and this policy lets that single link be READ, nothing else. An empty token matches nothing.
CREATE FUNCTION app_program_token() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.program_token', true), '') $$;--> statement-breakpoint
CREATE POLICY "program_links_by_token" ON "program_links" FOR SELECT
  USING ("token" = app_program_token());
