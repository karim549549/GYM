CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"audience" text NOT NULL,
	"channel" text DEFAULT 'whatsapp' NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"failed_reason" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminders_subject_kind_audience_key" UNIQUE("subject_type","subject_id","kind","audience"),
	CONSTRAINT "reminders_subject_type_check" CHECK ("reminders"."subject_type" in ('subscription', 'intake', 'checkin')),
	CONSTRAINT "reminders_kind_check" CHECK ("reminders"."kind" in ('expiring_soon', 'expired', 'payment_due', 'intake_nudge')),
	CONSTRAINT "reminders_audience_check" CHECK ("reminders"."audience" in ('coach', 'client')),
	CONSTRAINT "reminders_channel_check" CHECK ("reminders"."channel" in ('whatsapp', 'inapp', 'email'))
);
--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_client_workspace_fk" FOREIGN KEY ("client_id","workspace_id") REFERENCES "public"."clients"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reminders_due_idx" ON "reminders" USING btree ("scheduled_for") WHERE "reminders"."sent_at" is null;