-- A coach's own forms are tenant tables like the rest: a coach sees and changes only their workspace's,
-- and a query that forgets its scope sees nothing. The public intake and check-in forms read the
-- coach's form after the link is resolved, inside that link's workspace, so they need no policy of their own.
ALTER TABLE "form_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "form_templates" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "form_templates_tenant" ON "form_templates" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
ALTER TABLE "form_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "form_questions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "form_questions_tenant" ON "form_questions" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());
