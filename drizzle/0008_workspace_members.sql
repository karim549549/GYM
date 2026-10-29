-- Rename coaches to workspace_members and split ownership from the role.
-- "owner" was a role; it becomes the is_owner flag, and the role says what the member does.
ALTER TABLE "coaches" RENAME TO "workspace_members";--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "is_owner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- row level security is forced, so lift it for this one conversion or it would see no rows
ALTER TABLE "workspace_members" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
UPDATE "workspace_members" SET "is_owner" = true, "role" = 'coach' WHERE "role" = 'owner';--> statement-breakpoint
ALTER TABLE "workspace_members" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspace_members" DROP CONSTRAINT "coaches_role_check";--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_role_check" CHECK ("workspace_members"."role" in ('coach', 'assistant'));--> statement-breakpoint
ALTER TABLE "workspace_members" ALTER COLUMN "role" SET DEFAULT 'coach';--> statement-breakpoint
ALTER TABLE "workspace_members" RENAME CONSTRAINT "coaches_pkey" TO "workspace_members_pkey";--> statement-breakpoint
ALTER TABLE "workspace_members" RENAME CONSTRAINT "coaches_workspace_person_key" TO "workspace_members_workspace_person_key";--> statement-breakpoint
ALTER TABLE "workspace_members" RENAME CONSTRAINT "coaches_workspace_id_workspaces_id_fk" TO "workspace_members_workspace_id_workspaces_id_fk";--> statement-breakpoint
ALTER TABLE "workspace_members" RENAME CONSTRAINT "coaches_person_id_people_id_fk" TO "workspace_members_person_id_people_id_fk";--> statement-breakpoint
ALTER INDEX "coaches_person_id_idx" RENAME TO "workspace_members_person_id_idx";--> statement-breakpoint
ALTER POLICY "coaches_tenant" ON "workspace_members" RENAME TO "workspace_members_tenant";--> statement-breakpoint
ALTER POLICY "coaches_own_memberships" ON "workspace_members" RENAME TO "workspace_members_own_memberships";
