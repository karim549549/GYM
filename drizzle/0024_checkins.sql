CREATE TABLE "checkin_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"frequency" text DEFAULT 'weekly' NOT NULL,
	"day_of_week" integer,
	"send_hour" integer DEFAULT 8 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkin_schedules_client_key" UNIQUE("client_id"),
	CONSTRAINT "checkin_schedules_id_workspace_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "checkin_schedules_frequency_check" CHECK ("checkin_schedules"."frequency" in ('daily', 'every_2_days', 'weekly', 'fortnightly')),
	CONSTRAINT "checkin_schedules_day_of_week_check" CHECK ("checkin_schedules"."day_of_week" is null or "checkin_schedules"."day_of_week" between 0 and 6),
	CONSTRAINT "checkin_schedules_send_hour_check" CHECK ("checkin_schedules"."send_hour" between 0 and 23)
);
--> statement-breakpoint
CREATE TABLE "checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"schedule_id" uuid,
	"due_on" date NOT NULL,
	"token" text NOT NULL,
	"form_version" text NOT NULL,
	"answers" jsonb,
	"submitted_at" timestamp with time zone,
	"coach_reply" text,
	"replied_at" timestamp with time zone,
	"replied_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkins_token_unique" UNIQUE("token"),
	CONSTRAINT "checkins_client_due_on_key" UNIQUE("client_id","due_on")
);
--> statement-breakpoint
ALTER TABLE "reminders" DROP CONSTRAINT "reminders_kind_check";--> statement-breakpoint
ALTER TABLE "checkin_schedules" ADD CONSTRAINT "checkin_schedules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_schedules" ADD CONSTRAINT "checkin_schedules_client_workspace_fk" FOREIGN KEY ("client_id","workspace_id") REFERENCES "public"."clients"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_replied_by_people_id_fk" FOREIGN KEY ("replied_by") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_client_workspace_fk" FOREIGN KEY ("client_id","workspace_id") REFERENCES "public"."clients"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_schedule_workspace_fk" FOREIGN KEY ("schedule_id","workspace_id") REFERENCES "public"."checkin_schedules"("id","workspace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkins_workspace_submitted_idx" ON "checkins" USING btree ("workspace_id","submitted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "checkins_client_due_on_idx" ON "checkins" USING btree ("client_id","due_on" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_kind_check" CHECK ("reminders"."kind" in ('expiring_soon', 'expired', 'payment_due', 'intake_nudge', 'checkin_due'));