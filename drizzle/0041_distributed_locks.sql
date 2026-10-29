CREATE SEQUENCE "public"."locks_fencing_token_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9007199254740991 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "locks" (
	"key" text PRIMARY KEY NOT NULL,
	"owner" text,
	"fencing_token" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "locks_fencing_token_safe" CHECK ("locks"."fencing_token" between 1 and 9007199254740991)
);--> statement-breakpoint
REVOKE ALL ON TABLE "public"."locks" FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE ALL ON SEQUENCE "public"."locks_fencing_token_seq" FROM PUBLIC, anon, authenticated;
