CREATE TABLE "chat_documents" (
	"chat_id" text NOT NULL,
	"document_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_documents_chat_id_document_id_pk" PRIMARY KEY("chat_id","document_id")
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "sources" jsonb;--> statement-breakpoint
ALTER TABLE "chat_documents" ADD CONSTRAINT "chat_documents_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_documents" ADD CONSTRAINT "chat_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_documents_documentId_idx" ON "chat_documents" USING btree ("document_id");