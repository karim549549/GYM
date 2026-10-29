ALTER TABLE "intake_links" DROP CONSTRAINT "intake_links_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "intake_responses" DROP CONSTRAINT "intake_responses_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "measurements" DROP CONSTRAINT "measurements_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_id_workspace_key" UNIQUE("id","workspace_id");
--> statement-breakpoint
ALTER TABLE "intake_links" ADD CONSTRAINT "intake_links_client_workspace_fk" FOREIGN KEY ("client_id","workspace_id") REFERENCES "public"."clients"("id","workspace_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "intake_responses" ADD CONSTRAINT "intake_responses_client_workspace_fk" FOREIGN KEY ("client_id","workspace_id") REFERENCES "public"."clients"("id","workspace_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_client_workspace_fk" FOREIGN KEY ("client_id","workspace_id") REFERENCES "public"."clients"("id","workspace_id") ON DELETE cascade ON UPDATE no action;
