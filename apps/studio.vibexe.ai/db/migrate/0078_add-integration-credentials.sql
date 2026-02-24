CREATE TABLE "integration_credentials" (
	"db_id" serial PRIMARY KEY NOT NULL,
	"team_db_id" integer NOT NULL,
	"piece_name" text NOT NULL,
	"display_name" text NOT NULL,
	"auth_type" text NOT NULL,
	"encrypted_config" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_team_db_id_teams_db_id_fk" FOREIGN KEY ("team_db_id") REFERENCES "public"."teams"("db_id") ON DELETE no action ON UPDATE no action;
