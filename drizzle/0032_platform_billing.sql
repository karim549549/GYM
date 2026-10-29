CREATE TABLE "plans_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'EGP' NOT NULL,
	"client_limit" integer,
	"interval" text DEFAULT 'month' NOT NULL,
	CONSTRAINT "plans_catalog_interval_check" CHECK ("plans_catalog"."interval" in ('month', 'year')),
	CONSTRAINT "plans_catalog_price_check" CHECK ("plans_catalog"."price_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "platform_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"plan_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"method" text,
	"receipt_key" text,
	"paid_at" timestamp with time zone,
	"marked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_invoices_status_check" CHECK ("platform_invoices"."status" in ('open', 'paid', 'void', 'uncollectible')),
	CONSTRAINT "platform_invoices_method_check" CHECK ("platform_invoices"."method" is null or "platform_invoices"."method" in ('instapay', 'wallet', 'cash', 'bank', 'other')),
	CONSTRAINT "platform_invoices_amount_check" CHECK ("platform_invoices"."amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "platform_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"plan_id" text NOT NULL,
	"status" text DEFAULT 'trialing' NOT NULL,
	"current_period_start" date NOT NULL,
	"current_period_end" date NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_subscriptions_workspace_key" UNIQUE("workspace_id"),
	CONSTRAINT "platform_subscriptions_status_check" CHECK ("platform_subscriptions"."status" in ('trialing', 'active', 'past_due', 'cancelled')),
	CONSTRAINT "platform_subscriptions_period_check" CHECK ("platform_subscriptions"."current_period_end" >= "platform_subscriptions"."current_period_start")
);
--> statement-breakpoint
ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_plan_id_plans_catalog_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_marked_by_people_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_plan_id_plans_catalog_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_invoices_open_idx" ON "platform_invoices" USING btree ("status","period_end") WHERE "platform_invoices"."status" = 'open';--> statement-breakpoint
CREATE INDEX "platform_invoices_workspace_idx" ON "platform_invoices" USING btree ("workspace_id");