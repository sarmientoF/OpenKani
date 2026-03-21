import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: integer("created_at").notNull(),
});
