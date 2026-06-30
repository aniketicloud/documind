import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

export * from "./auth-schema"

export const todos = pgTable("todos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
})
