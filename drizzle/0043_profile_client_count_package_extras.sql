ALTER TABLE "packages" ADD COLUMN "check_in_frequency" text;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "includes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "client_count_range" text;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_check_in_frequency_check" CHECK ("packages"."check_in_frequency" is null or "packages"."check_in_frequency" in ('daily', 'every_2_days', 'weekly', 'fortnightly'));--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_includes_check" CHECK ("packages"."includes" <@ array['workout', 'nutrition']::text[]);--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_client_count_range_check" CHECK ("workspace_members"."client_count_range" is null or "workspace_members"."client_count_range" in ('lt5', 'r5_20', 'r20_50', 'gt50'));