CREATE TABLE "reminder_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_messages_workspace_kind_key" UNIQUE("workspace_id","kind"),
	CONSTRAINT "reminder_messages_kind_check" CHECK ("reminder_messages"."kind" in ('expiring', 'expired', 'payment_due')),
	CONSTRAINT "reminder_messages_body_check" CHECK (char_length("reminder_messages"."body") between 1 and 500)
);
--> statement-breakpoint
ALTER TABLE "reminder_messages" ADD CONSTRAINT "reminder_messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;