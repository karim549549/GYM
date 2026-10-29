-- The four tables of a workout plan are tenant tables like the rest: a coach sees and changes only
-- the plans of the workspace the request acts in, and a query that forgets its scope sees nothing.
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plans" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "plans_tenant" ON "plans" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
ALTER TABLE "plan_days" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plan_days" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "plan_days_tenant" ON "plan_days" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
ALTER TABLE "plan_exercises" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plan_exercises" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "plan_exercises_tenant" ON "plan_exercises" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
ALTER TABLE "plan_sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plan_sets" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "plan_sets_tenant" ON "plan_sets" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());
