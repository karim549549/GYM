CREATE TABLE "client_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "client_consents_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"type" text NOT NULL,
	"granted" boolean NOT NULL,
	"text_version" text NOT NULL,
	"source" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_consents_type_check" CHECK ("client_consents"."type" in ('data_processing', 'health_data', 'whatsapp_notifications')),
	CONSTRAINT "client_consents_source_check" CHECK ("client_consents"."source" in ('signup', 'account', 'intake_link', 'checkin_link', 'coach_on_behalf'))
);
--> statement-breakpoint
CREATE TABLE "person_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "person_consents_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"person_id" uuid NOT NULL,
	"type" text NOT NULL,
	"granted" boolean NOT NULL,
	"text_version" text NOT NULL,
	"source" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_consents_type_check" CHECK ("person_consents"."type" in ('terms', 'privacy_policy', 'platform_notifications')),
	CONSTRAINT "person_consents_source_check" CHECK ("person_consents"."source" in ('signup', 'account', 'intake_link', 'checkin_link', 'coach_on_behalf'))
);
--> statement-breakpoint
ALTER TABLE "client_consents" ADD CONSTRAINT "client_consents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_consents" ADD CONSTRAINT "client_consents_client_workspace_fk" FOREIGN KEY ("client_id","workspace_id") REFERENCES "public"."clients"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_consents" ADD CONSTRAINT "person_consents_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_consents_client_type_idx" ON "client_consents" USING btree ("client_id","type","seq" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "person_consents_person_type_idx" ON "person_consents" USING btree ("person_id","type","seq" DESC NULLS LAST);