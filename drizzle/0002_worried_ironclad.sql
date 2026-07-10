CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"content_type" text,
	"size" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "documents_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_userId_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "documents" USING btree ("status");