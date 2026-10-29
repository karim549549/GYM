CREATE TABLE "coaches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"specialties" text[] DEFAULT '{}'::text[] NOT NULL,
	"bio" text,
	"instagram" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coaches_workspace_person_key" UNIQUE("workspace_id","person_id"),
	CONSTRAINT "coaches_role_check" CHECK ("coaches"."role" in ('owner', 'coach', 'assistant'))
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"auth_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_phone_unique" UNIQUE("phone"),
	CONSTRAINT "people_email_unique" UNIQUE("email"),
	CONSTRAINT "people_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"currency" char(3) DEFAULT 'EGP' NOT NULL,
	"unit_system" text DEFAULT 'metric' NOT NULL,
	"expiry_alert_days" integer DEFAULT 7 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug"),
	CONSTRAINT "workspaces_unit_system_check" CHECK ("workspaces"."unit_system" in ('metric', 'imperial'))
);
--> statement-breakpoint
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coaches_person_id_idx" ON "coaches" USING btree ("person_id");