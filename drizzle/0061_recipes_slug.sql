ALTER TABLE "recipes" ADD COLUMN "slug" text;--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_global_slug_idx" ON "recipes" USING btree ("slug") WHERE "recipes"."workspace_id" is null;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_slug_check" CHECK ("recipes"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');