ALTER TABLE "form_questions" DROP CONSTRAINT "form_questions_input_type_check";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_method_check";--> statement-breakpoint
ALTER TABLE "checkin_schedules" ADD COLUMN "send_at" time DEFAULT '08:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "checkin_schedules" ADD COLUMN "starts_on" date DEFAULT current_date NOT NULL;--> statement-breakpoint
ALTER TABLE "checkin_schedules" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
UPDATE "checkin_schedules" SET "day_of_week" = 5 WHERE "day_of_week" IS NULL;--> statement-breakpoint
UPDATE "checkin_schedules" SET "send_at" = make_time("send_hour", 0, 0), "starts_on" = ("created_at" AT TIME ZONE 'Africa/Cairo')::date;--> statement-breakpoint
ALTER TABLE "checkin_schedules" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "checkin_schedules" ALTER COLUMN "day_of_week" SET DEFAULT 5;--> statement-breakpoint
ALTER TABLE "checkin_schedules" ALTER COLUMN "day_of_week" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
UPDATE "payments" SET "method" = 'other' WHERE "method" = 'card';--> statement-breakpoint
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "form_questions" ADD CONSTRAINT "form_questions_input_type_check" CHECK ("form_questions"."input_type" in ('short_text', 'long_text', 'number', 'single_select', 'multi_select', 'dropdown', 'date', 'boolean', 'scale', 'image'));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_method_check" CHECK ("payments"."method" in ('instapay', 'wallet', 'cash', 'bank', 'other'));
