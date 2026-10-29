CREATE TABLE "intake_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '14 days' NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "intake_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "intake_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"link_id" uuid,
	"answers" jsonb NOT NULL,
	"form_version" text DEFAULT 'default_v1' NOT NULL,
	"submitted_by" text DEFAULT 'client' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "intake_responses_submitted_by_check" CHECK ("intake_responses"."submitted_by" in ('client', 'coach'))
);
--> statement-breakpoint
CREATE TABLE "measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"value" numeric(8, 2) NOT NULL,
	"unit" text NOT NULL,
	"measured_at" date NOT NULL,
	"source" text DEFAULT 'checkin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "measurements_client_metric_day_key" UNIQUE("client_id","metric","measured_at"),
	CONSTRAINT "measurements_source_check" CHECK ("measurements"."source" in ('intake', 'checkin', 'coach'))
);
--> statement-breakpoint
ALTER TABLE "intake_links" ADD CONSTRAINT "intake_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_links" ADD CONSTRAINT "intake_links_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_responses" ADD CONSTRAINT "intake_responses_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_responses" ADD CONSTRAINT "intake_responses_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_responses" ADD CONSTRAINT "intake_responses_link_id_intake_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."intake_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intake_links_client_id_idx" ON "intake_links" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "intake_responses_client_id_idx" ON "intake_responses" USING btree ("client_id","submitted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "measurements_client_metric_idx" ON "measurements" USING btree ("client_id","metric","measured_at" DESC NULLS LAST);