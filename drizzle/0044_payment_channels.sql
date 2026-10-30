CREATE TABLE "payment_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"method" text NOT NULL,
	"account" text NOT NULL,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_channels_method_check" CHECK ("payment_channels"."method" in ('instapay', 'wallet', 'bank')),
	CONSTRAINT "payment_channels_url_check" CHECK ("payment_channels"."url" is null or "payment_channels"."url" ~ '^https://[^[:space:]]+$')
);
--> statement-breakpoint
ALTER TABLE "payment_channels" ADD CONSTRAINT "payment_channels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_channels_workspace_id_idx" ON "payment_channels" USING btree ("workspace_id");