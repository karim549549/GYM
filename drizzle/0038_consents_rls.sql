-- A client's consents are a ledger: a coach's workspace can add a row and read them, never edit or remove one
-- (a row only goes with its client or workspace). There is deliberately no UPDATE or DELETE policy.
ALTER TABLE "client_consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_consents" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "client_consents_read" ON "client_consents" FOR SELECT
  USING ("workspace_id" = app_workspace_id());--> statement-breakpoint
CREATE POLICY "client_consents_add" ON "client_consents" FOR INSERT
  WITH CHECK ("workspace_id" = app_workspace_id());
