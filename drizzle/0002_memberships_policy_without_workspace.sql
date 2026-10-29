-- The memberships policy must not widen a workspace-scoped request: when a
-- workspace is set, the request sees that workspace and nothing else, even for
-- rows that belong to the same person in another workspace.
DROP POLICY "coaches_own_memberships" ON "coaches";
--> statement-breakpoint
CREATE POLICY "coaches_own_memberships" ON "coaches" FOR SELECT
  USING ("person_id" = app_person_id() AND app_workspace_id() IS NULL);
