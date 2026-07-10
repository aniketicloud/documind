import {
  index,
  integer,
  pgTable,
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

/** Uploaded files stored in RustFS (S3). Metadata lives in Postgres. */
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
