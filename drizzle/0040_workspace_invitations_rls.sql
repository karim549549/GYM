-- A workspace's owner sees and changes the invitations of their own workspace. The invited person
-- is not in the workspace yet, so they could not read an invitation that way: a second, read-only policy
-- lets a signed-in person read the invitations addressed to their own verified phone number, and
-- nothing else. Accepting or declining then happens inside the invitation's workspace, as with the
-- public links, so no policy has to let an outsider write.
ALTER TABLE "workspace_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspace_invitations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_invitations_tenant" ON "workspace_invitations" FOR ALL
  USING ("workspace_id" = app_workspace_id())
  WITH CHECK ("workspace_id" = app_workspace_id());--> statement-breakpoint
CREATE POLICY "workspace_invitations_for_invitee" ON "workspace_invitations" FOR SELECT
  USING ("phone" = (SELECT "phone" FROM "people" WHERE "id" = app_person_id()));
