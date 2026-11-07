import {
  index,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const partnershipLogsTable = pgTable(
  "partnership_logs",
  {
    id: serial("id").primaryKey(),
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    representativeId: varchar("representative_id", { length: 20 }).notNull(),
    advertisement: text("advertisement").notNull(),
    logChannelId: varchar("log_channel_id", { length: 20 }).notNull(),
    loggedById: varchar("logged_by_id", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (table) => [
    index("partnership_logs_guild_rep_left_idx").on(
      table.guildId,
      table.representativeId,
      table.leftAt,
    ),
  ],
);
