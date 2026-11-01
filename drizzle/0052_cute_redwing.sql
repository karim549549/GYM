CREATE TABLE "payment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"token" text NOT NULL,
	"client_name" text NOT NULL,
	"package_name" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"note" text,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"paid_method" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_requests_token_unique" UNIQUE("token"),
	CONSTRAINT "payment_requests_amount_minor_check" CHECK ("payment_requests"."amount_minor" > 0),
	CONSTRAINT "payment_requests_paid_check" CHECK (("payment_requests"."paid_at" is null) = ("payment_requests"."paid_method" is null)),
	CONSTRAINT "payment_requests_method_check" CHECK ("payment_requests"."paid_method" is null or "payment_requests"."paid_method" in ('instapay', 'wallet', 'cash', 'bank', 'other'))
);
--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_created_by_people_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_subscription_workspace_fk" FOREIGN KEY ("subscription_id","workspace_id") REFERENCES "public"."subscriptions"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_client_workspace_fk" FOREIGN KEY ("client_id","workspace_id") REFERENCES "public"."clients"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_requests_workspace_created_idx" ON "payment_requests" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "payment_requests_subscription_idx" ON "payment_requests" USING btree ("subscription_id");