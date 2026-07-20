import {
  db,
  modCreditsTable,
  modLogsTable,
  inactivityWarningsTable,
  guildSettingsTable,
} from "@workspace/db";
import { eq, and, desc, gte } from "drizzle-orm";
import type { Client, Guild, TextChannel } from "discord.js";
import { EmbedBuilder, Colors } from "discord.js";
import { demoteModerator } from "./demote.js";

/** Get or create settings for a guild */
async function getSettings(guildId: string) {
  const rows = await db
    .select()
    .from(guildSettingsTable)
    .where(eq(guildSettingsTable.guildId, guildId))
    .limit(1);

  if (rows.length > 0) return rows[0];

  // Default settings
  const [created] = await db
    .insert(guildSettingsTable)
    .values({ guildId })
    .returning();
  return created;
}

async function getLastActionDate(
  guildId: string,
  userId: string
): Promise<Date | null> {
  const rows = await db
    .select()
    .from(modLogsTable)
    .where(
      and(
        eq(modLogsTable.guildId, guildId),
        eq(modLogsTable.moderatorId, userId)
      )
    )
    .orderBy(desc(modLogsTable.createdAt))
    .limit(1);

  // Exclude demote actions from last-activity calculation
  const realAction = rows.find((r) => r.action !== "demote");
  return realAction?.createdAt ?? null;
}

async function postToLogChannel(
  guild: Guild,
  embed: EmbedBuilder
): Promise<void> {
  const channelId = process.env.DISCORD_LOG_CHANNEL_ID;
  if (!channelId) return;

  const channel = guild.channels.cache.get(channelId) as
    | TextChannel
    | undefined;
  if (!channel?.isTextBased()) return;

  try {
    await channel.send({ embeds: [embed] });
  } catch {
    // Channel may be inaccessible — ignore
  }
}

/**
 * Run the inactivity check for a single guild.
 * Called on a schedule from the main bot process.
 */
export async function checkGuildInactivity(guild: Guild): Promise<void> {
  const settings = await getSettings(guild.id);
  if (!settings.inactivityEnabled) return;

  const mods = await db
    .select()
    .from(modCreditsTable)
    .where(eq(modCreditsTable.guildId, guild.id));

  if (mods.length === 0) return;

  const now = Date.now();
  const inactivityMs = settings.inactivityDays * 24 * 60 * 60 * 1000;
  const cutoff = new Date(now - inactivityMs);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  for (const mod of mods) {
    try {
      const lastAction = await getLastActionDate(guild.id, mod.userId);

      const isInactive = !lastAction || lastAction < cutoff;
      if (!isInactive) continue;

      // Check if already warned within the last inactivityDays window
      const recentWarnings = await db
        .select()
        .from(inactivityWarningsTable)
        .where(
          and(
            eq(inactivityWarningsTable.guildId, guild.id),
            eq(inactivityWarningsTable.userId, mod.userId),
            gte(inactivityWarningsTable.createdAt, thirtyDaysAgo)
          )
        );

      const warnedRecently = recentWarnings.some(
        (w) => w.createdAt >= cutoff
      );
      if (warnedRecently) continue;

      // Issue inactivity warning
      const reason = lastAction
        ? `No moderation activity since <t:${Math.floor(lastAction.getTime() / 1000)}:R>`
        : `No moderation activity recorded`;

      await db.insert(inactivityWarningsTable).values({
        guildId: guild.id,
        userId: mod.userId,
        reason: `Inactive for ${settings.inactivityDays}+ days`,
      });

      const warningCount = recentWarnings.length + 1; // including the new one

      // Demote if threshold reached
      if (warningCount >= settings.warningsBeforeDemote) {
        const result = await demoteModerator(
          guild,
          mod.userId,
          `Automated demotion: ${warningCount} inactivity warnings in 30 days`
        );

        const embed = new EmbedBuilder()
          .setColor(Colors.DarkRed)
          .setTitle("📉 Auto-Demotion: Inactivity")
          .addFields(
            { name: "Moderator", value: `<@${mod.userId}>`, inline: true },
            {
              name: "From",
              value: result.fromRole ?? "Unknown",
              inline: true,
            },
            { name: "To", value: result.toRole ?? "None", inline: true },
            {
              name: "Reason",
              value: `${warningCount} inactivity warnings in the past 30 days`,
            }
          )
          .setTimestamp();

        await postToLogChannel(guild, embed);

        // DM the mod
        try {
          const user = await guild.client.users.fetch(mod.userId);
          await user.send({
            embeds: [
              new EmbedBuilder()
                .setColor(Colors.DarkRed)
                .setTitle(`📉 You have been demoted in ${guild.name}`)
                .addFields(
                  {
                    name: "From",
                    value: result.fromRole ?? "Unknown",
                    inline: true,
                  },
                  {
                    name: "To",
                    value: result.toRole ?? "None",
                    inline: true,
                  },
                  {
                    name: "Reason",
                    value: `You received ${warningCount} inactivity warnings due to no moderation activity in the past ${settings.inactivityDays} days.`,
                  }
                )
                .setTimestamp(),
            ],
          });
        } catch {
          // DMs disabled
        }
      } else {
        // Just warn
        const warnsLeft = settings.warningsBeforeDemote - warningCount;
        const embed = new EmbedBuilder()
          .setColor(Colors.Orange)
          .setTitle("⚠️ Inactivity Warning")
          .addFields(
            { name: "Moderator", value: `<@${mod.userId}>`, inline: true },
            {
              name: "Warning",
              value: `${warningCount} of ${settings.warningsBeforeDemote}`,
              inline: true,
            },
            {
              name: "Status",
              value: `${warnsLeft} more warning${warnsLeft !== 1 ? "s" : ""} before demotion`,
              inline: true,
            },
            {
              name: "Reason",
              value: `No moderation activity in the past ${settings.inactivityDays} days`,
            }
          )
          .setTimestamp();

        await postToLogChannel(guild, embed);

        // DM the mod
        try {
          const user = await guild.client.users.fetch(mod.userId);
          await user.send({
            embeds: [
              new EmbedBuilder()
                .setColor(Colors.Orange)
                .setTitle(`⚠️ Inactivity Warning in ${guild.name}`)
                .addFields(
                  {
                    name: "Warning",
                    value: `${warningCount} of ${settings.warningsBeforeDemote}`,
                    inline: true,
                  },
                  {
                    name: "Action Required",
                    value: `Please take some moderation action in the server. You have ${warnsLeft} more warning${warnsLeft !== 1 ? "s" : ""} before automatic demotion.`,
                  }
                )
                .setTimestamp(),
            ],
          });
        } catch {
          // DMs disabled
        }
      }
    } catch (err) {
      console.error(`[inactivity] Error checking mod ${mod.userId}:`, err);
    }
  }
}

/**
 * Run inactivity checks across all guilds.
 * Call this on startup and then on an interval.
 */
export async function runInactivityChecks(client: Client): Promise<void> {
  console.log(
    `[Inactivity] Running checks across ${client.guilds.cache.size} guild(s)...`
  );
  for (const guild of client.guilds.cache.values()) {
    await checkGuildInactivity(guild);
  }
  console.log("[Inactivity] Checks complete.");
}
