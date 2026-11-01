-- A coach sees and changes only the payment requests of the workspace the request acts in.
ALTER TABLE "payment_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_requests" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "payment_requests_tenant" ON "payment_requests" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
-- The payment page opens with no login. The link's token is the credential: the backend sets it for
-- one request, and this policy lets that single request be READ, nothing else. An empty token matches nothing.
CREATE FUNCTION app_payment_token() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.payment_token', true), '') $$;--> statement-breakpoint
CREATE POLICY "payment_requests_by_token" ON "payment_requests" FOR SELECT
  USING ("token" = app_payment_token());
