CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"person_id" uuid,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"intake_status" text DEFAULT 'pending' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_workspace_phone_key" UNIQUE("workspace_id","phone"),
	CONSTRAINT "clients_intake_status_check" CHECK ("clients"."intake_status" in ('pending', 'submitted', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_workspace_id_idx" ON "clients" USING btree ("workspace_id") WHERE "clients"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "clients_person_id_idx" ON "clients" USING btree ("person_id");