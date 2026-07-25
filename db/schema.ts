import {
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

import { user } from "./auth-schema"

export * from "./auth-schema"

export const todos = pgTable("todos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
})

/**
 * Uploaded files stored in RustFS (S3). Metadata lives in Postgres.
 * status: pending | ready | processing | indexed | failed
 */
export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    key: text("key").notNull().unique(),
    contentType: text("content_type"),
    size: integer("size"),
    status: text("status").notNull().default("pending"),
    /** Last ingest/upload error (when status = failed) */
    errorMessage: text("error_message"),
    /** Successful ingest completion time */
    processedAt: timestamp("processed_at"),
    /** How many times ingest has been attempted */
    ingestAttempts: integer("ingest_attempts").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("documents_userId_idx").on(table.userId),
    index("documents_status_idx").on(table.status),
  ]
)

/**
 * Async document ingest jobs (Option A foundation).
 * status: queued | running | succeeded | failed
 */
export const documentJobs = pgTable(
  "document_jobs",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("ingest"),
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    lastError: text("last_error"),
    lockedAt: timestamp("locked_at"),
    lockedBy: text("locked_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("document_jobs_documentId_idx").on(table.documentId),
    index("document_jobs_status_idx").on(table.status),
    index("document_jobs_userId_idx").on(table.userId),
  ]
)

/** Conversation thread (ChatGPT-style history item). */
export const chats = pgTable(
  "chats",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New chat"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("chats_userId_idx").on(table.userId),
    index("chats_updatedAt_idx").on(table.updatedAt),
  ]
)

/** Messages within a chat. Roles: user | assistant | system */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("chat_messages_chatId_idx").on(table.chatId),
    index("chat_messages_createdAt_idx").on(table.createdAt),
  ]
)

/** Documents attached to a specific message (user message attachments). */
export const chatMessageDocuments = pgTable(
  "chat_message_documents",
  {
    messageId: text("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.messageId, table.documentId] }),
    index("chat_message_documents_documentId_idx").on(table.documentId),
  ]
)
