CREATE TABLE "workspace_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"role" text DEFAULT 'assistant' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"brand_name" text NOT NULL,
	"invited_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invitations_status_check" CHECK ("workspace_invitations"."status" in ('pending', 'accepted', 'declined', 'revoked')),
	CONSTRAINT "workspace_invitations_role_check" CHECK ("workspace_invitations"."role" in ('coach', 'assistant'))
);
--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_people_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitations_one_pending_idx" ON "workspace_invitations" USING btree ("workspace_id","phone") WHERE "workspace_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "workspace_invitations_phone_idx" ON "workspace_invitations" USING btree ("phone");