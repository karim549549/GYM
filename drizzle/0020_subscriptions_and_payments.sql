CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"method" text NOT NULL,
	"paid_on" date NOT NULL,
	"receipt_key" text,
	"note" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_minor_check" CHECK ("payments"."amount_minor" > 0),
	CONSTRAINT "payments_method_check" CHECK ("payments"."method" in ('instapay', 'wallet', 'cash', 'bank', 'card', 'other'))
);
--> statement-breakpoint
CREATE TABLE "subscription_freezes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"frozen_on" date NOT NULL,
	"resumed_on" date,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_freezes_dates_check" CHECK ("subscription_freezes"."resumed_on" is null or "subscription_freezes"."resumed_on" >= "subscription_freezes"."frozen_on")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"package_id" uuid,
	"package_name" text NOT NULL,
	"price_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_id_workspace_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "subscriptions_dates_check" CHECK ("subscriptions"."ends_on" >= "subscriptions"."starts_on"),
	CONSTRAINT "subscriptions_price_minor_check" CHECK ("subscriptions"."price_minor" >= 0),
	CONSTRAINT "subscriptions_status_check" CHECK ("subscriptions"."status" in ('active', 'frozen', 'ended', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_id_workspace_key" UNIQUE("id","workspace_id");
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_people_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_workspace_fk" FOREIGN KEY ("subscription_id","workspace_id") REFERENCES "public"."subscriptions"("id","workspace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_workspace_fk" FOREIGN KEY ("client_id","workspace_id") REFERENCES "public"."clients"("id","workspace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_freezes" ADD CONSTRAINT "subscription_freezes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_freezes" ADD CONSTRAINT "subscription_freezes_subscription_workspace_fk" FOREIGN KEY ("subscription_id","workspace_id") REFERENCES "public"."subscriptions"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_client_workspace_fk" FOREIGN KEY ("client_id","workspace_id") REFERENCES "public"."clients"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_package_workspace_fk" FOREIGN KEY ("package_id","workspace_id") REFERENCES "public"."packages"("id","workspace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_workspace_paid_on_idx" ON "payments" USING btree ("workspace_id","paid_on" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "payments_subscription_idx" ON "payments" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "payments_client_idx" ON "payments" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_freezes_one_open_idx" ON "subscription_freezes" USING btree ("subscription_id") WHERE "subscription_freezes"."resumed_on" is null;--> statement-breakpoint
CREATE INDEX "subscriptions_workspace_status_ends_idx" ON "subscriptions" USING btree ("workspace_id","status","ends_on");--> statement-breakpoint
CREATE INDEX "subscriptions_client_starts_idx" ON "subscriptions" USING btree ("client_id","starts_on" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_one_live_per_client_idx" ON "subscriptions" USING btree ("client_id") WHERE "subscriptions"."status" in ('active', 'frozen');--> statement-breakpoint
