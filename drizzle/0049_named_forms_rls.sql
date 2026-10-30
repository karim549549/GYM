-- A coach sees and changes only the named forms of the workspace the request acts in.
-- Like every tenant table: row level security enabled and forced, one policy on the workspace scope,
-- so a query that forgets its scope sees nothing.
ALTER TABLE "named_forms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "named_forms_tenant" ON "named_forms" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
-- Until now a coach had one custom intake form. It becomes their first named form, so nothing is
-- lost (its versions, and the answers that point at them, are the same rows) and the built-in form is
-- the default again. Row level security is forced on these tables, so it is lifted for the backfill only.
ALTER TABLE "form_templates" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "named_forms" ("workspace_id", "purpose", "name")
SELECT DISTINCT "workspace_id", 'intake', 'فورم البداية بتاعي'
FROM "form_templates"
WHERE "purpose" = 'intake' AND "named_form_id" IS NULL;--> statement-breakpoint
UPDATE "form_templates" AS t
SET "named_form_id" = n."id"
FROM "named_forms" AS n
WHERE t."purpose" = 'intake'
  AND t."named_form_id" IS NULL
  AND n."workspace_id" = t."workspace_id"
  AND n."purpose" = 'intake';--> statement-breakpoint
ALTER TABLE "form_templates" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "named_forms" FORCE ROW LEVEL SECURITY;
