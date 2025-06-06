import { pgTable, varchar , uuid , text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm/sql";
export const users = pgTable("users", {
    id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
    name: varchar({ length: 255 }).notNull(),
    image: varchar({length: 255}),
    email: varchar({ length: 255 }).notNull().unique(),
    password: varchar({ length: 255 }).notNull(),
    provider: text().default("credentials"),
});


