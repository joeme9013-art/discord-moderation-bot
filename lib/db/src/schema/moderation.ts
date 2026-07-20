import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Logs all moderation actions (bans, kicks, timeouts, warns, demotions)
export const modLogsTable = pgTable("mod_logs", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  moderatorId: text("moderator_id").notNull(),
  targetId: text("target_id").notNull(),
  action: text("action").notNull(), // ban | kick | timeout | warn | unban | demote | promote
  reason: text("reason"),
  creditsAwarded: integer("credits_awarded").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertModLogSchema = createInsertSchema(modLogsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertModLog = z.infer<typeof insertModLogSchema>;
export type ModLog = typeof modLogsTable.$inferSelect;

// Tracks credits for each moderator per guild
export const modCreditsTable = pgTable("mod_credits", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  credits: integer("credits").notNull().default(0),
  totalEarned: integer("total_earned").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ModCredits = typeof modCreditsTable.$inferSelect;

// Stores warnings issued to users
export const warningsTable = pgTable("warnings", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  moderatorId: text("moderator_id").notNull(),
  reason: text("reason").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Warning = typeof warningsTable.$inferSelect;

// User feedback about moderators
export const feedbackTable = pgTable("feedback", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  moderatorId: text("moderator_id").notNull(),
  message: text("message").notNull(),
  isPositive: boolean("is_positive").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Feedback = typeof feedbackTable.$inferSelect;

// Configurable role thresholds per guild (maps Discord role → credits required)
export const roleThresholdsTable = pgTable("role_thresholds", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  roleId: text("role_id").notNull(),
  roleName: text("role_name").notNull(),
  creditsRequired: integer("credits_required").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type RoleThreshold = typeof roleThresholdsTable.$inferSelect;

// Tracks automated inactivity warnings issued to moderators
export const inactivityWarningsTable = pgTable("inactivity_warnings", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type InactivityWarning = typeof inactivityWarningsTable.$inferSelect;

// Per-guild configuration (inactivity thresholds, etc.)
export const guildSettingsTable = pgTable("guild_settings", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(),
  inactivityDays: integer("inactivity_days").notNull().default(7),
  warningsBeforeDemote: integer("warnings_before_demote").notNull().default(3),
  inactivityEnabled: boolean("inactivity_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type GuildSettings = typeof guildSettingsTable.$inferSelect;
