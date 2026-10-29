-- What the platform sells, from the product's pricing (Deep Dive, "Recommended pricing"): a free tier of
-- up to 5 clients so a beginner grows inside the product, one paid tier, and an unlimited one. Yearly
-- plans cost ten months. Prices are in piastres. These are the product's own figures; changing one is a
-- new migration, never an edit.
INSERT INTO "plans_catalog" ("id", "name", "price_minor", "currency", "client_limit", "interval") VALUES
  ('free', 'Free', 0, 'EGP', 5, 'month'),
  ('basic', 'Basic', 39900, 'EGP', 30, 'month'),
  ('pro', 'Pro', 79900, 'EGP', NULL, 'month'),
  ('basic_annual', 'Basic (yearly)', 399000, 'EGP', 30, 'year'),
  ('pro_annual', 'Pro (yearly)', 799000, 'EGP', NULL, 'year');--> statement-breakpoint
-- Every workspace that exists starts on the free plan. A free plan has no period to run out, so its
-- period ends on the last date there is.
INSERT INTO "platform_subscriptions" ("workspace_id", "plan_id", "status", "current_period_start", "current_period_end")
SELECT "id", 'free', 'active', current_date, date '9999-12-31' FROM "workspaces";--> statement-breakpoint
-- The coach's plan and what they owe are tenant tables like the rest: a coach sees only their own, and
-- a query that forgets its scope sees nothing.
ALTER TABLE "platform_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "platform_subscriptions_tenant" ON "platform_subscriptions" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
ALTER TABLE "platform_invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "platform_invoices" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "platform_invoices_tenant" ON "platform_invoices" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
-- The platform's own people confirm transfers across every coach's invoices, so they act in no single
-- workspace. As the system they reach these two tables only (the same scope the reminder sender uses),
-- and the backend lets only a platform admin do it.
CREATE POLICY "platform_subscriptions_system" ON "platform_subscriptions" FOR ALL
  USING (app_is_system())
  WITH CHECK (app_is_system());--> statement-breakpoint
CREATE POLICY "platform_invoices_system" ON "platform_invoices" FOR ALL
  USING (app_is_system())
  WITH CHECK (app_is_system());--> statement-breakpoint
-- A client limit enforced only in the screen is not a limit, so the database enforces it. Adding a
-- client, or bringing a removed one back, is refused at the plan's limit with the code GY001, which the
-- API turns into CLIENT_LIMIT_REACHED for the app to answer with an upgrade prompt. The coach's plan row
-- is locked while it is counted, so two additions at the same moment cannot both take the last place. A
-- workspace with no plan row has no limit.
CREATE FUNCTION check_client_limit() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
    RETURN NEW;
  END IF;

  SELECT pc.client_limit INTO v_limit
  FROM platform_subscriptions ps
  JOIN plans_catalog pc ON pc.id = ps.plan_id
  WHERE ps.workspace_id = NEW.workspace_id
  FOR UPDATE OF ps;

  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count FROM clients
  WHERE workspace_id = NEW.workspace_id AND deleted_at IS NULL;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'client_limit_reached' USING ERRCODE = 'GY001';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER enforce_client_limit
  BEFORE INSERT OR UPDATE OF deleted_at ON "clients"
  FOR EACH ROW EXECUTE FUNCTION check_client_limit();
