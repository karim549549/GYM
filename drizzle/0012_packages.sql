CREATE TABLE "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"duration_days" integer NOT NULL,
	"price_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'EGP' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "packages_duration_days_check" CHECK ("packages"."duration_days" > 0),
	CONSTRAINT "packages_price_minor_check" CHECK ("packages"."price_minor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "packages_workspace_id_idx" ON "packages" USING btree ("workspace_id");